// Drag to reorder. Hold a card's grip handle and move your finger: a small
// tag with the exercise name follows your finger, a gold line shows where the
// card will land, and the page scrolls by itself near the top or bottom of
// the screen. Let go to drop it there.
//
// Exercise cards are taller than most of the screen, so dragging the whole
// card would hide where it is going. The tag and line keep that visible.
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentRef,
  type ReactElement,
  type ReactNode,
  type RefObject,
} from 'react';
import {
  Animated,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';

import { tapMedium, tapStep } from '../lib/haptics';
import { dropIndex, edgeScrollSpeed, insertionLineY, type Rect } from '../lib/reorder';
import { colors, fonts, shadow } from '../theme';

const GHOST_HEIGHT = 56;

type ScrollRef = ComponentRef<typeof ScrollView>;
type ViewRef = ComponentRef<typeof View>;

/** What the floating tag shows for the card being dragged. */
export type GhostInfo = { title: string; color: string };

/** Where a view sits on screen. (Every native view can report this; the types just vary.) */
function measureInWindow(
  node: unknown,
  callback: (x: number, y: number, width: number, height: number) => void,
) {
  const measurable = node as {
    measureInWindow?: (cb: (x: number, y: number, w: number, h: number) => void) => void;
  } | null;
  measurable?.measureInWindow?.(callback);
}

/** Connects a SortableList to the scrolling page it sits in. */
export type ScrollBridge = {
  ref: RefObject<ScrollRef | null>;
  offset: { current: number };
  maxOffset: { current: number };
  /** Top and bottom of the visible scroll area, in screen coordinates. */
  viewport: { current: { top: number; bottom: number } };
  setScrollEnabled: (enabled: boolean) => void;
  showGhost: (info: GhostInfo, fingerY: number) => void;
  moveGhost: (fingerY: number) => void;
  hideGhost: () => void;
};

/**
 * Sets up a page for drag-to-reorder. Spread `scrollProps` onto the page's
 * ScrollView, wrap that ScrollView in a View with `hostProps`, and render
 * `overlay` right after the ScrollView (it draws the floating tag).
 */
export function useScrollBridge(bottomInset = 0) {
  const ref = useRef<ScrollRef | null>(null);
  const hostRef = useRef<ViewRef | null>(null);
  const hostTop = useRef(0);
  const offset = useRef(0);
  const maxOffset = useRef(0);
  const sizes = useRef({ content: 0, layout: 0 });
  const viewport = useRef({ top: 0, bottom: 0 });
  const [scrollEnabled, setScrollEnabled] = useState(true);
  const [ghost, setGhost] = useState<GhostInfo | null>(null);
  const [ghostY] = useState(() => new Animated.Value(0));
  const { height: windowHeight } = useWindowDimensions();
  const insetRef = useRef({ windowHeight, bottomInset });
  useEffect(() => {
    insetRef.current = { windowHeight, bottomInset };
  }, [windowHeight, bottomInset]);

  const [bridge] = useState<ScrollBridge>(() => {
    const place = (fingerY: number) =>
      ghostY.setValue(fingerY - hostTop.current - GHOST_HEIGHT / 2);
    const measureHost = () =>
      measureInWindow(hostRef.current, (_x, y, _w, h) => {
        if (!Number.isFinite(y) || !Number.isFinite(h)) return;
        hostTop.current = y;
        viewport.current = {
          top: y,
          bottom: Math.min(y + h, insetRef.current.windowHeight) - insetRef.current.bottomInset,
        };
      });
    return {
      ref,
      offset,
      maxOffset,
      viewport,
      setScrollEnabled,
      showGhost: (info, fingerY) => {
        measureHost();
        place(fingerY);
        setGhost(info);
      },
      moveGhost: place,
      hideGhost: () => setGhost(null),
    };
  });

  const updateMax = () => {
    maxOffset.current = Math.max(0, sizes.current.content - sizes.current.layout);
  };

  const scrollProps = {
    ref,
    scrollEnabled,
    scrollEventThrottle: 16,
    onScroll: (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      offset.current = e.nativeEvent.contentOffset.y;
    },
    onContentSizeChange: (_w: number, h: number) => {
      sizes.current.content = h;
      updateMax();
    },
    onLayout: (e: LayoutChangeEvent) => {
      sizes.current.layout = e.nativeEvent.layout.height;
      updateMax();
    },
  };

  const hostProps = { ref: hostRef, style: styles.host, collapsable: false };

  const overlay = ghost ? (
    <Animated.View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.ghost, shadow, { transform: [{ translateY: ghostY }] }]}
    >
      <View style={[styles.ghostDot, { backgroundColor: ghost.color }]} />
      <Text style={styles.ghostText} numberOfLines={1}>
        {ghost.title}
      </Text>
      <Text style={styles.ghostHint}>Moving</Text>
    </Animated.View>
  ) : null;

  return { bridge, scrollProps, hostProps, overlay };
}

export type DragControls = {
  /** Wrap the grip handle in this to make it start a drag. */
  handle: (grip: ReactElement) => ReactElement;
  /** True while this card is the one being moved. */
  isDragging: boolean;
};

type Props<T> = {
  data: T[];
  keyExtractor: (item: T) => string;
  renderItem: (item: T, index: number, drag: DragControls) => ReactNode;
  /** What the floating tag should say for an item. */
  ghostFor: (item: T) => GhostInfo;
  /** Called once, when a card is dropped in a new place. */
  onMove: (from: number, to: number) => void;
  scroll: ScrollBridge;
  /** Space under each card. */
  gap?: number;
};

type ActiveDrag = {
  key: string;
  from: number;
  to: number;
  /** Where to draw the landing line, or null while the card is still in its own slot. */
  lineY: number | null;
};

type Session = {
  key: string;
  from: number;
  to: number;
  rects: Rect[];
  /** Finger position inside the list when the drag started. */
  pointer0: number;
  startAbsY: number;
  absY: number;
  translationY: number;
  scroll0: number;
  timer: ReturnType<typeof setInterval> | null;
};

export function SortableList<T>({
  data,
  keyExtractor,
  renderItem,
  ghostFor,
  onMove,
  scroll,
  gap = 16,
}: Props<T>) {
  const [active, setActive] = useState<ActiveDrag | null>(null);
  const layouts = useRef(new Map<string, Rect>());
  const session = useRef<Session | null>(null);
  const listRef = useRef<ViewRef | null>(null);
  const latest = useRef({ data, keyExtractor, ghostFor, onMove, scroll, gap });
  useEffect(() => {
    latest.current = { data, keyExtractor, ghostFor, onMove, scroll, gap };
  });

  /** Works out where the card would land for the finger's current position. */
  const apply = useCallback(() => {
    const s = session.current;
    if (!s) return;
    const bridge = latest.current.scroll;
    bridge.moveGhost(s.absY);
    const fingerInList = s.pointer0 + s.translationY + (bridge.offset.current - s.scroll0);
    const to = dropIndex(s.rects, s.from, fingerInList);
    if (to !== s.to) {
      s.to = to;
      tapStep();
      setActive({
        key: s.key,
        from: s.from,
        to,
        lineY: to === s.from ? null : insertionLineY(s.rects, s.from, to, latest.current.gap),
      });
    }
  }, []);

  /** Runs about 60 times a second during a drag: scrolls the page when held near an edge. */
  const autoScroll = useCallback(() => {
    const s = session.current;
    if (!s) return;
    const bridge = latest.current.scroll;
    const { top, bottom } = bridge.viewport.current;
    const speed = bottom > top ? edgeScrollSpeed(s.absY, top, bottom) : 0;
    if (speed !== 0) {
      const target = Math.max(0, Math.min(bridge.maxOffset.current, bridge.offset.current + speed));
      if (target !== bridge.offset.current) {
        bridge.ref.current?.scrollTo({ y: target, animated: false });
        // Assume it landed; the real position arrives with the next scroll event.
        bridge.offset.current = target;
        apply();
      }
    }
  }, [apply]);

  const begin = useCallback(
    (key: string, absY: number) => {
      if (session.current) return;
      const { data: items, keyExtractor: keyOf, ghostFor: ghost, scroll: bridge } = latest.current;
      const keys = items.map(keyOf);
      const from = keys.indexOf(key);
      if (from < 0) return;
      const rects = keys.map((k) => layouts.current.get(k) ?? { y: 0, height: 0 });
      const s: Session = {
        key,
        from,
        to: from,
        rects,
        // Until the list is measured, assume the grip sits near the top of its card.
        pointer0: rects[from].y + 30,
        startAbsY: absY,
        absY,
        translationY: 0,
        scroll0: bridge.offset.current,
        timer: null,
      };
      session.current = s;
      measureInWindow(listRef.current, (_x, y) => {
        if (session.current === s && Number.isFinite(y)) s.pointer0 = s.startAbsY - y;
      });
      bridge.setScrollEnabled(false);
      bridge.showGhost(ghost(items[from]), absY);
      setActive({ key, from, to: from, lineY: null });
      tapMedium();
      s.timer = setInterval(autoScroll, 16);
    },
    [autoScroll],
  );

  const update = useCallback(
    (absY: number, translationY: number) => {
      const s = session.current;
      if (!s) return;
      s.absY = absY;
      s.translationY = translationY;
      apply();
    },
    [apply],
  );

  const end = useCallback(() => {
    const s = session.current;
    if (!s) return;
    if (s.timer != null) clearInterval(s.timer);
    session.current = null;
    const bridge = latest.current.scroll;
    bridge.setScrollEnabled(true);
    bridge.hideGhost();
    setActive(null);
    if (s.to !== s.from) {
      tapMedium();
      latest.current.onMove(s.from, s.to);
    }
  }, []);

  // If the list goes away mid-drag, tidy up.
  useEffect(
    () => () => {
      const s = session.current;
      if (!s) return;
      if (s.timer != null) clearInterval(s.timer);
      session.current = null;
      latest.current.scroll.setScrollEnabled(true);
      latest.current.scroll.hideGhost();
    },
    [],
  );

  const lineY = active?.lineY ?? null;

  return (
    <View ref={listRef} collapsable={false}>
      {data.map((item, index) => {
        const key = keyExtractor(item);
        return (
          <SortableRow
            key={key}
            id={key}
            gap={gap}
            dragging={active?.key === key}
            canDrag={data.length > 1}
            onLayout={(rect) => layouts.current.set(key, rect)}
            onBegin={begin}
            onUpdate={update}
            onEnd={end}
          >
            {(drag) => renderItem(item, index, drag)}
          </SortableRow>
        );
      })}
      {lineY !== null && (
        <View pointerEvents="none" style={[styles.line, { top: lineY - 3 }]}>
          <View style={styles.lineKnob} />
          <View style={styles.lineBar} />
          <View style={styles.lineKnob} />
        </View>
      )}
    </View>
  );
}

function SortableRow({
  id,
  gap,
  dragging,
  canDrag,
  onLayout,
  onBegin,
  onUpdate,
  onEnd,
  children,
}: {
  id: string;
  gap: number;
  dragging: boolean;
  canDrag: boolean;
  onLayout: (rect: Rect) => void;
  onBegin: (key: string, absY: number) => void;
  onUpdate: (absY: number, translationY: number) => void;
  onEnd: () => void;
  children: (drag: DragControls) => ReactNode;
}) {
  const pan = usePanGesture({
    enabled: canDrag,
    // Plain callbacks on the main JavaScript thread; nothing here needs more.
    disableReanimated: true,
    runOnJS: true,
    // Start almost at once so the page's own scrolling never grabs the finger first.
    minDistance: 2,
    onActivate: (e) => onBegin(id, e.absoluteY),
    onUpdate: (e) => onUpdate(e.absoluteY, e.translationY),
    onDeactivate: () => onEnd(),
    onFinalize: () => onEnd(),
  });

  const handle = (grip: ReactElement) => <GestureDetector gesture={pan}>{grip}</GestureDetector>;

  return (
    <View
      onLayout={(e: LayoutChangeEvent) =>
        onLayout({ y: e.nativeEvent.layout.y, height: e.nativeEvent.layout.height })
      }
      style={[{ paddingBottom: gap }, dragging && styles.dimmed]}
    >
      {children({ handle, isDragging: dragging })}
    </View>
  );
}

const styles = StyleSheet.create({
  host: { flex: 1 },
  dimmed: { opacity: 0.4 },
  ghost: {
    position: 'absolute',
    top: 0,
    left: 28,
    right: 28,
    height: GHOST_HEIGHT,
    borderRadius: GHOST_HEIGHT / 2,
    backgroundColor: colors.ink,
    borderWidth: 2,
    borderColor: colors.gold,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 18,
  },
  ghostDot: { width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: colors.white },
  ghostText: { flex: 1, color: colors.white, fontFamily: fonts.heading, fontSize: 17 },
  ghostHint: { color: colors.gold, fontFamily: fonts.heading, fontSize: 13, letterSpacing: 0.6 },
  line: {
    position: 'absolute',
    left: -4,
    right: -4,
    height: 6,
    flexDirection: 'row',
    alignItems: 'center',
  },
  lineBar: { flex: 1, height: 4, backgroundColor: colors.gold, borderRadius: 2 },
  lineKnob: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.gold },
});
