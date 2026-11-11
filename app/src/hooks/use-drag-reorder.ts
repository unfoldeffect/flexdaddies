import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { flushSync } from "react-dom";

import { dropIndex, edgeScrollSpeed, insertionLineY } from "../lib/reorder";

// The bottom tab bar covers this much of the screen, so auto-scroll starts above it.
const BOTTOM_BAR = 90;

/**
 * Drag-to-reorder for a vertical list, for mouse and touch.
 *
 * Mark the list with `data-reorder-list`, each direct child card with
 * `data-reorder-id={id}` and `data-reorder-label` (its name), and spread `handleProps(id, label)` on the drag
 * handle inside the card.
 *
 * Cards are often taller than the screen, so the card itself stays put while
 * dragging: a small tag with the exercise name follows the pointer and a gold
 * line shows where the card will land. On release `onMove` is called once per
 * place moved, up (-1) or down (+1).
 */
export function useDragReorder(onMove: (id: string, delta: -1 | 1) => void) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const onMoveRef = useRef(onMove);
  onMoveRef.current = onMove;
  const stopRef = useRef<((commit: boolean) => void) | null>(null);

  useEffect(() => () => stopRef.current?.(false), []);

  const start = (id: string, label: string, e: ReactPointerEvent<HTMLElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const list = e.currentTarget.closest<HTMLElement>("[data-reorder-list]");
    if (!list) return;
    const items = () =>
      Array.from(list.children).filter(
        (el): el is HTMLElement => el instanceof HTMLElement && !!el.dataset.reorderId,
      );
    const from = items().findIndex((el) => el.dataset.reorderId === id);
    if (from < 0) return;

    e.preventDefault();
    stopRef.current?.(false);

    const pointerId = e.pointerId;
    let pointerX = e.clientX;
    let pointerY = e.clientY;
    let to = from;
    let frame = 0;

    // The tag that follows the pointer.
    const tag = document.createElement("div");
    tag.className = "drag-tag";
    tag.setAttribute("aria-hidden", "true");
    const tagName = document.createElement("span");
    tagName.className = "drag-tag-name";
    tagName.textContent = label || "Exercise";
    // Says where it will land, since the line can be off screen on tall cards.
    const tagWhere = document.createElement("span");
    tagWhere.className = "drag-tag-where";
    tag.append(tagName, tagWhere);
    // The line that marks the landing spot.
    const line = document.createElement("div");
    line.className = "drag-line";
    line.setAttribute("aria-hidden", "true");
    line.style.display = "none";
    document.body.append(line, tag);

    const update = () => {
      const tagWidth = tag.offsetWidth;
      const x = Math.min(
        Math.max(8, pointerX - tagWidth + 24),
        Math.max(8, window.innerWidth - tagWidth - 8),
      );
      // Above the finger so it isn't hidden, and never off the top of the screen.
      const y = Math.max(8, pointerY - tag.offsetHeight - 28);
      tag.style.transform = `translate(${x}px, ${y}px)`;

      const els = items();
      const rects = els.map((el) => {
        const r = el.getBoundingClientRect();
        return { y: r.top, height: r.height, left: r.left, width: r.width };
      });
      to = dropIndex(rects, from, pointerY);
      if (to === from || !rects[to]) {
        line.style.display = "none";
        tagWhere.textContent = "";
        return;
      }
      const neighbour = els[to].dataset.reorderLabel || `exercise ${to + 1}`;
      tagWhere.textContent = `${to < from ? "Before" : "After"} ${neighbour}`;
      const gap = rects.length > 1 ? Math.max(0, rects[1].y - rects[0].y - rects[0].height) : 0;
      const lineY = insertionLineY(rects, from, to, gap);
      line.style.display = "block";
      line.style.left = `${rects[to].left}px`;
      line.style.width = `${rects[to].width}px`;
      line.style.transform = `translateY(${lineY - 3}px)`;
    };

    const tick = () => {
      const speed = edgeScrollSpeed(pointerY, 0, window.innerHeight - BOTTOM_BAR);
      if (speed) window.scrollBy(0, speed);
      update();
      frame = requestAnimationFrame(tick);
    };

    const onPointerMove = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      pointerX = ev.clientX;
      pointerY = ev.clientY;
      update();
    };
    const onPointerUp = (ev: PointerEvent) => {
      if (ev.pointerId === pointerId) stop(true);
    };
    const onPointerCancel = (ev: PointerEvent) => {
      if (ev.pointerId === pointerId) stop(false);
    };

    const prevUserSelect = document.body.style.userSelect;
    function stop(commit: boolean) {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerCancel);
      document.body.style.userSelect = prevUserSelect;
      tag.remove();
      line.remove();
      stopRef.current = null;
      setDraggingId(null);
      if (commit && to !== from) {
        const delta = to > from ? 1 : -1;
        for (let i = 0; i < Math.abs(to - from); i++) {
          flushSync(() => onMoveRef.current(id, delta));
        }
        if (navigator.vibrate) navigator.vibrate(15);
      }
    }

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerCancel);
    document.body.style.userSelect = "none";
    stopRef.current = stop;
    setDraggingId(id);
    update();
    frame = requestAnimationFrame(tick);
  };

  const handleProps = (id: string, label: string) => ({
    onPointerDown: (e: ReactPointerEvent<HTMLElement>) => start(id, label, e),
  });

  return { draggingId, handleProps };
}
