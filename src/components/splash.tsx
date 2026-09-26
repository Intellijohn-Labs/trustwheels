import { Logo } from "./logo";

/**
 * First-visit splash: the logo builds itself and a speed bar fills, then the screen fades out.
 * Pure CSS; THEME_SCRIPT hides it before paint on later loads in the same session.
 */
export function Splash() {
  return (
    <div className="splash" aria-hidden>
      <div className="w-[min(80vw,520px)]">
        <Logo motion="intro" title="" />
        <div className="mx-auto mt-8 h-1 w-2/3 overflow-hidden rounded-full bg-sunken">
          <div className="splash-bar" />
        </div>
      </div>
    </div>
  );
}
