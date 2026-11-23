import { useState } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp } from 'lucide-react';

interface TouchGamepadProps {
  onKey: (key: string, code: string, keyCode: number, action: 'down' | 'up') => void;
}

export default function TouchGamepad({ onKey }: TouchGamepadProps) {
  const [wasdMode, setWasdMode] = useState(false);

  const dpadKeys = wasdMode
    ? {
        up: { key: 'w', code: 'KeyW', keyCode: 87 },
        down: { key: 's', code: 'KeyS', keyCode: 83 },
        left: { key: 'a', code: 'KeyA', keyCode: 65 },
        right: { key: 'd', code: 'KeyD', keyCode: 68 },
      }
    : {
        up: { key: 'ArrowUp', code: 'ArrowUp', keyCode: 38 },
        down: { key: 'ArrowDown', code: 'ArrowDown', keyCode: 40 },
        left: { key: 'ArrowLeft', code: 'ArrowLeft', keyCode: 37 },
        right: { key: 'ArrowRight', code: 'ArrowRight', keyCode: 39 },
      };

  function bindTouch(spec: { key: string; code: string; keyCode: number }) {
    return {
      onPointerDown: (e: React.PointerEvent) => {
        e.preventDefault();
        (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
        onKey(spec.key, spec.code, spec.keyCode, 'down');
      },
      onPointerUp: (e: React.PointerEvent) => {
        e.preventDefault();
        onKey(spec.key, spec.code, spec.keyCode, 'up');
      },
      onPointerCancel: () => {
        onKey(spec.key, spec.code, spec.keyCode, 'up');
      },
    };
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-30 flex items-end justify-between px-4 sm:px-8 select-none">
      {/* Left D-Pad */}
      <div className="pointer-events-auto flex flex-col items-center gap-2">
        <button
          type="button"
          onClick={() => setWasdMode((v) => !v)}
          className="rounded-md border border-white/25 bg-black/55 px-2.5 py-1 text-[11px] font-semibold text-white/90 backdrop-blur-md"
        >
          {wasdMode ? 'D-Pad: WASD' : 'D-Pad: Arrows'}
        </button>
        <div className="grid grid-cols-3 gap-1.5 touch-none">
          <div />
          <button
            type="button"
            aria-label="Up"
            {...bindTouch(dpadKeys.up)}
            className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/25 bg-black/55 text-white active:bg-purple-600/80 backdrop-blur-md touch-none"
          >
            <ArrowUp className="h-5 w-5" />
          </button>
          <div />
          <button
            type="button"
            aria-label="Left"
            {...bindTouch(dpadKeys.left)}
            className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/25 bg-black/55 text-white active:bg-purple-600/80 backdrop-blur-md touch-none"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            aria-label="Down"
            {...bindTouch(dpadKeys.down)}
            className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/25 bg-black/55 text-white active:bg-purple-600/80 backdrop-blur-md touch-none"
          >
            <ArrowDown className="h-5 w-5" />
          </button>
          <button
            type="button"
            aria-label="Right"
            {...bindTouch(dpadKeys.right)}
            className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/25 bg-black/55 text-white active:bg-purple-600/80 backdrop-blur-md touch-none"
          >
            <ArrowRight className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Right Action Buttons */}
      <div className="pointer-events-auto flex flex-col items-end gap-2 touch-none">
        <div className="flex gap-2">
          <button
            type="button"
            {...bindTouch({ key: 'Enter', code: 'Enter', keyCode: 13 })}
            className="h-10 rounded-lg border border-white/25 bg-black/55 px-3.5 text-xs font-bold text-white active:bg-purple-600/80 backdrop-blur-md touch-none"
          >
            ENTER
          </button>
          <button
            type="button"
            {...bindTouch({ key: ' ', code: 'Space', keyCode: 32 })}
            className="h-10 rounded-lg border border-white/25 bg-black/55 px-3.5 text-xs font-bold text-white active:bg-purple-600/80 backdrop-blur-md touch-none"
          >
            SPACE
          </button>
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            {...bindTouch({ key: 'x', code: 'KeyX', keyCode: 88 })}
            className="flex h-14 w-14 items-center justify-center rounded-full border border-pink-400/40 bg-pink-600/60 text-base font-bold text-white active:bg-pink-500 backdrop-blur-md touch-none"
          >
            X
          </button>
          <button
            type="button"
            {...bindTouch({ key: 'z', code: 'KeyZ', keyCode: 90 })}
            className="flex h-14 w-14 items-center justify-center rounded-full border border-purple-400/50 bg-purple-600/70 text-base font-bold text-white active:bg-purple-500 backdrop-blur-md touch-none"
          >
            Z
          </button>
        </div>
      </div>
    </div>
  );
}
