import { statsFor, type Card } from "./cards";

// Mouse aiming complements click and keyboard play; touch keeps native hand scrolling.
export function installCardDrag(
  root: HTMLElement,
  cardFor: (uid: string) => Card | undefined,
  play: (uid: string, target?: string) => void,
) {
  let gesture: {
    uid: string;
    button: HTMLElement;
    x: number;
    y: number;
    pointer: number;
    card: Card;
    dragging: boolean;
  } | null = null;
  let overlay: HTMLDivElement | null = null;
  let aimed: HTMLElement | null = null;
  let suppressNextClick = false;
  const cleanup = () => {
    overlay?.remove();
    overlay = null;
    aimed?.classList.remove("aimed");
    aimed = null;
    document.body.classList.remove("dragging-card");
    gesture = null;
  };
  root.addEventListener("pointerdown", (event) => {
    suppressNextClick = false;
    if (event.button !== 0 || event.pointerType !== "mouse") return;
    const button = (event.target as HTMLElement).closest<HTMLElement>(
      '.hand [data-action="play"]',
    );
    const uid = button?.dataset.id;
    const card = uid ? cardFor(uid) : undefined;
    if (!button || button.hasAttribute("disabled") || !uid || !card) return;
    gesture = {
      uid,
      button,
      x: event.clientX,
      y: event.clientY,
      pointer: event.pointerId,
      card,
      dragging: false,
    };
    button.setPointerCapture(event.pointerId);
  });
  document.addEventListener("pointermove", (event) => {
    const g = gesture;
    if (!g || g.pointer !== event.pointerId) return;
    if (!g.dragging && Math.hypot(event.clientX - g.x, event.clientY - g.y) < 9)
      return;
    event.preventDefault();
    if (!g.dragging) {
      g.dragging = true;
      document.body.classList.add("dragging-card");
      overlay = document.createElement("div");
      overlay.className = "card-drag-layer";
      overlay.setAttribute("aria-hidden", "true");
      overlay.innerHTML =
        '<svg class="aim-line"><path/></svg><div class="drag-card"></div>';
      overlay.querySelector(".drag-card")!.append(g.button.cloneNode(true));
      document.body.append(overlay);
    }
    const card = overlay!.querySelector<HTMLElement>(".drag-card")!;
    card.style.transform = `translate(${event.clientX - 65}px,${event.clientY - 160}px)`;
    const middleX = (g.x + event.clientX) / 2;
    overlay!
      .querySelector("path")!
      .setAttribute(
        "d",
        `M${g.x} ${g.y} Q${middleX} ${Math.min(g.y, event.clientY) - 90} ${event.clientX} ${event.clientY}`,
      );
    const target =
      document
        .elementFromPoint(event.clientX, event.clientY)
        ?.closest<HTMLElement>(".enemy-fighter:not(:disabled)") ?? null;
    if (target !== aimed) {
      aimed?.classList.remove("aimed");
      aimed = target;
      aimed?.classList.add("aimed");
    }
  });
  document.addEventListener("pointerup", (event) => {
    const g = gesture;
    if (!g || g.pointer !== event.pointerId) return;
    const dragging = g.dragging;
    const enemy = aimed?.dataset.id;
    const field = document
      .elementFromPoint(event.clientX, event.clientY)
      ?.closest(".battlefield");
    const needsTarget = !!(
      statsFor(g.card).damage ||
      statsFor(g.card).weak ||
      statsFor(g.card).vulnerable ||
      statsFor(g.card).poison
    );
    cleanup();
    if (!dragging) return;
    suppressNextClick = true;
    if (enemy || (!needsTarget && field)) play(g.uid, enemy);
  });
  document.addEventListener("pointercancel", cleanup);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") cleanup();
  });
  window.addEventListener("blur", cleanup);
  return {
    suppressClick: () => {
      const suppressed = suppressNextClick;
      suppressNextClick = false;
      return suppressed;
    },
  };
}
