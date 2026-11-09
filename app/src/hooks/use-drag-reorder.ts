import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { flushSync } from "react-dom";

import { dragStepDelta } from "../lib/workout-helpers";

const EDGE = 70; // px from the top/bottom of the screen where auto-scroll kicks in
const SCROLL_SPEED = 12; // px per frame

/**
 * Drag-to-reorder for a vertical list, for mouse and touch.
 *
 * Mark the list with `data-reorder-list`, each direct child card with
 * `data-reorder-id={id}`, and spread `handleProps(id)` on the drag handle
 * inside the card. The card follows the pointer and `onMove` is called each
 * time it should swap places with the card above (-1) or below (+1).
 */
export function useDragReorder(onMove: (id: string, delta: -1 | 1) => void) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const onMoveRef = useRef(onMove);
  onMoveRef.current = onMove;
  const stopRef = useRef<(() => void) | null>(null);

  useEffect(() => () => stopRef.current?.(), []);

  const start = (id: string, e: ReactPointerEvent<HTMLElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const list = e.currentTarget.closest<HTMLElement>("[data-reorder-list]");
    if (!list) return;
    const items = () =>
      Array.from(list.children).filter(
        (el): el is HTMLElement => el instanceof HTMLElement && !!el.dataset.reorderId,
      );
    const card = items().find((el) => el.dataset.reorderId === id);
    if (!card) return;

    e.preventDefault();
    stopRef.current?.();

    const pointerId = e.pointerId;
    let pointerY = e.clientY;
    // Where on the card it was grabbed, so it stays under the finger.
    const grabOffset = pointerY - card.getBoundingClientRect().top;
    let shift = 0;
    let frame = 0;

    const follow = () => {
      const naturalTop = card.getBoundingClientRect().top - shift;
      shift = pointerY - grabOffset - naturalTop;
      card.style.transform = `translateY(${shift}px)`;
    };

    const update = () => {
      const els = items();
      const index = els.indexOf(card);
      const rects = els.map((el) => {
        const r = el.getBoundingClientRect();
        // The dragged card is shifted; the others sit at their real position.
        return { top: el === card ? r.top - shift : r.top, height: r.height };
      });
      const delta = dragStepDelta(rects, index, pointerY);
      if (delta) flushSync(() => onMoveRef.current(id, delta));
      follow();
    };

    const tick = () => {
      if (pointerY < EDGE) window.scrollBy(0, -SCROLL_SPEED);
      else if (pointerY > window.innerHeight - EDGE) window.scrollBy(0, SCROLL_SPEED);
      update();
      frame = requestAnimationFrame(tick);
    };

    const onPointerMove = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      pointerY = ev.clientY;
      update();
    };
    const onPointerEnd = (ev: PointerEvent) => {
      if (ev.pointerId === pointerId) stop();
    };

    const prevUserSelect = document.body.style.userSelect;
    function stop() {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerEnd);
      window.removeEventListener("pointercancel", onPointerEnd);
      document.body.style.userSelect = prevUserSelect;
      card!.style.transform = "";
      stopRef.current = null;
      setDraggingId(null);
    }

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerEnd);
    window.addEventListener("pointercancel", onPointerEnd);
    document.body.style.userSelect = "none";
    stopRef.current = stop;
    setDraggingId(id);
    frame = requestAnimationFrame(tick);
  };

  const handleProps = (id: string) => ({
    onPointerDown: (e: ReactPointerEvent<HTMLElement>) => start(id, e),
  });

  return { draggingId, handleProps };
}
