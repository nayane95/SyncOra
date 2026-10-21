import { Relay, Riffle } from "@lucasmarkes/hairline/react";
import { useEffect, useRef, useState } from "react";

export default function LoginIllustration({
  variant = "cards",
}: {
  variant?: "cards" | "relay";
}) {
  const Figure = variant === "relay" ? Relay : Riffle;
  const [readout, setReadout] = useState("rest");
  const relayIndex = useRef(0);
  const [reducedMotion, setReducedMotion] = useState(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  const [playing, setPlaying] = useState(true);
  const active = playing && !reducedMotion;
  useEffect(() => {
    if (!active) return;
    const timer = window.setTimeout(() => setPlaying(false), 4000);
    return () => clearTimeout(timer);
  }, [active]);
  return (
    <figure className="login-illustration">
      <Figure
        className="login-hairline"
        theme={variant === "relay" ? "auto" : "dark"}
        intensity={0.5}
        play={active}
        label={
          variant === "relay"
            ? "Interactive team relay. Move the pointer or use arrow keys to lift connected tiles along a path."
            : "Interactive illustration of a tray of task cards. Move the pointer or use arrow keys to lift a card."
        }
        role={variant === "relay" ? "group" : undefined}
        tabIndex={variant === "relay" ? 0 : undefined}
        onRead={variant === "relay" ? setReadout : undefined}
        onKeyDown={
          variant === "relay"
            ? (event) => {
                if (
                  !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(
                    event.key,
                  )
                )
                  return;
                event.preventDefault();
                setPlaying(false);
                const stops = [
                  [45, 145],
                  [140, 253],
                  [271, 258],
                  [355, 216],
                  [344, 151],
                ];
                const direction =
                  event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 1;
                relayIndex.current =
                  (relayIndex.current + direction + stops.length) %
                  stops.length;
                const [x, y] = stops[relayIndex.current];
                const rect = event.currentTarget.getBoundingClientRect();
                event.currentTarget.dispatchEvent(
                  new PointerEvent("pointermove", {
                    clientX: rect.left + (rect.width * x) / 400,
                    clientY: rect.top + (rect.height * y) / 320,
                    bubbles: true,
                  }),
                );
              }
            : undefined
        }
        onBlur={
          variant === "relay"
            ? (event) =>
                event.currentTarget.dispatchEvent(
                  new PointerEvent("pointerleave"),
                )
            : undefined
        }
        onPointerEnter={() => setPlaying(false)}
        onFocus={() => setPlaying(false)}
      />
      {variant === "relay" && (
        <span className="sr-only" aria-live="polite">
          {readout}
        </span>
      )}
    </figure>
  );
}
