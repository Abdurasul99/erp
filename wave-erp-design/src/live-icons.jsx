import React from 'react';
import { motion } from 'framer-motion';
import { Icon } from './icons.jsx';

// «Живые» глифы для Launchpad: каждая иконка — зацикленная микро-анимация.
// active=false → статичная Icon (страницы вне экрана не анимируем ради производительности).

const loop = (duration, delay = 0, extra = {}) => ({
  duration, delay, repeat: Infinity, ease: 'easeInOut', ...extra,
});
const org = (x = 12, y = 12) => ({ transformBox: 'view-box', transformOrigin: `${x}px ${y}px` });

const LIVE = {
  chart: (
    <>
      <motion.path d="M6 19.5v-7" initial={{ pathLength: 1 }} animate={{ pathLength: [1, 0.45, 1] }} transition={loop(2.6)} />
      <motion.path d="M12 19.5v-13" initial={{ pathLength: 1 }} animate={{ pathLength: [1, 0.6, 1] }} transition={loop(2.6, 0.35)} />
      <motion.path d="M18 19.5v-9.5" initial={{ pathLength: 1 }} animate={{ pathLength: [1, 0.4, 1] }} transition={loop(2.6, 0.7)} />
    </>
  ),
  dollar: (
    <>
      <circle cx="12" cy="12" r="8.4" />
      <motion.path
        d="M12 7.2v9.6M14.6 9.1c-.6-.8-1.5-1.2-2.6-1.2-1.4 0-2.4.7-2.4 1.9 0 2.6 5.2 1.2 5.2 3.9 0 1.2-1.1 1.9-2.7 1.9-1.3 0-2.3-.5-2.9-1.3"
        style={org()} animate={{ scale: [1, 1.12, 1] }} transition={loop(2.8)}
      />
    </>
  ),
  megaphone: (
    <>
      <motion.path
        d="M4 10.5v3.6l2.6.5L9 19.4h1.9l-1.3-4.2 9.4 2V6.5L6.6 9.9 4 10.5Z"
        style={org(11, 13)} animate={{ rotate: [-3, 2, -3] }} transition={loop(3)}
      />
      <motion.path
        d="M21 10.2a2.6 2.6 0 0 1 0 3.4"
        style={org(20, 12)} animate={{ opacity: [0.15, 1, 0.15], scale: [0.85, 1.2, 0.85] }} transition={loop(1.8)}
      />
    </>
  ),
  cart: (
    <motion.g style={org(12, 13)} animate={{ rotate: [0, -3.5, 2.5, 0], x: [0, 0.6, -0.4, 0] }} transition={loop(3.2)}>
      <path d="M3.5 5H6l2.3 10.3h8.9L19.8 8H6.7" />
      <circle cx="9" cy="19" r="1.5" />
      <circle cx="16" cy="19" r="1.5" />
    </motion.g>
  ),
  box: (
    <motion.g style={org()} animate={{ rotate: [0, -2.5, 2.5, 0], scale: [1, 1.04, 1] }} transition={loop(3.6)}>
      <path d="m12 3 8 4.4v9.2L12 21l-8-4.4V7.4L12 3Z" />
      <path d="m4.2 7.5 7.8 4.3 7.8-4.3" />
      <motion.path d="M12 11.8V21" animate={{ opacity: [1, 0.35, 1] }} transition={loop(3.6, 0.9)} />
    </motion.g>
  ),
  bag: (
    <motion.g style={org(12, 5)} animate={{ rotate: [-4.5, 4.5, -4.5] }} transition={loop(3.1)}>
      <path d="M6.2 8.3h11.6l-.9 11.2H7.1L6.2 8.3Z" />
      <path d="M9.2 8.3V6.5a2.8 2.8 0 0 1 5.6 0v1.8" />
    </motion.g>
  ),
  people: (
    <>
      <motion.g style={org(9, 13)} animate={{ y: [0, -0.7, 0] }} transition={loop(2.8)}>
        <circle cx="9" cy="8.6" r="3" />
        <path d="M3.6 19c.5-2.9 2.7-4.4 5.4-4.4s4.9 1.5 5.4 4.4" />
      </motion.g>
      <motion.g style={org(17, 13)} animate={{ scale: [0.92, 1.08, 0.92], y: [0, -0.5, 0] }} transition={loop(2.8, 1.2)}>
        <circle cx="16.6" cy="9.6" r="2.3" />
        <path d="M16 14.8c2.4.3 4 1.6 4.4 4.2" />
      </motion.g>
    </>
  ),
  headset: (
    <motion.g style={org()} animate={{ y: [0, -0.9, 0] }} transition={loop(3)}>
      <path d="M4.5 14v-1.5a7.5 7.5 0 0 1 15 0V14" />
      <rect x="3.4" y="13.6" width="3.6" height="5.2" rx="1.6" />
      <rect x="17" y="13.6" width="3.6" height="5.2" rx="1.6" />
      <motion.path
        d="M19 18.8v.6a2.4 2.4 0 0 1-2.4 2.4H13"
        initial={{ pathLength: 0 }} animate={{ pathLength: [0, 1, 1], opacity: [1, 1, 0] }}
        transition={loop(2.6, 0, { times: [0, 0.55, 1] })}
      />
    </motion.g>
  ),
  gear: (
    <motion.g style={org()} animate={{ rotate: 360 }} transition={{ duration: 7, repeat: Infinity, ease: 'linear' }}>
      <circle cx="12" cy="12" r="3.1" />
      <path d="M12 3.6v2.2M12 18.2v2.2M20.4 12h-2.2M5.8 12H3.6M17.9 6.1l-1.5 1.5M7.6 16.4l-1.5 1.5M17.9 17.9l-1.5-1.5M7.6 7.6 6.1 6.1" />
    </motion.g>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8.4" />
      <motion.path d="M12 12V7.6" style={org()} animate={{ rotate: 360 }} transition={{ duration: 3.6, repeat: Infinity, ease: 'linear' }} />
      <motion.path d="M12 12l3 1.4" style={org()} animate={{ rotate: 360 }} transition={{ duration: 21, repeat: Infinity, ease: 'linear' }} />
    </>
  ),
  alert: (
    <>
      <motion.path d="M12 4.6 21 19H3L12 4.6Z" style={org(12, 13)} animate={{ scale: [1, 1.05, 1] }} transition={loop(1.7)} />
      <motion.g animate={{ opacity: [1, 0.15, 1] }} transition={loop(1.7)}>
        <path d="M12 10.2v3.6" />
        <path d="M12 16.4v.1" />
      </motion.g>
    </>
  ),
  doc: (
    <>
      <path d="M7 3.8h7l4 4v12.4H7V3.8Z" />
      <path d="M13.6 3.8v4.4H18" />
      <motion.path d="M9.6 12.4h5" initial={{ pathLength: 0 }} animate={{ pathLength: [0, 1, 1], opacity: [1, 1, 0.25] }} transition={loop(2.6, 0, { times: [0, 0.45, 1] })} />
      <motion.path d="M9.6 15.6h5" initial={{ pathLength: 0 }} animate={{ pathLength: [0, 1, 1], opacity: [1, 1, 0.25] }} transition={loop(2.6, 0.5, { times: [0, 0.45, 1] })} />
    </>
  ),
  search: (
    <motion.g animate={{ x: [0, 1.4, 0, -1.4, 0], y: [0, -1, 1.1, -0.4, 0] }} transition={loop(3.6)}>
      <circle cx="11" cy="11" r="6.2" />
      <path d="m15.6 15.6 4.4 4.4" />
    </motion.g>
  ),
  sparkle: (
    <>
      <motion.path
        d="m12 3.5 1.7 4.8 4.8 1.7-4.8 1.7L12 16.5l-1.7-4.8-4.8-1.7 4.8-1.7L12 3.5Z"
        style={org(12, 10)} animate={{ scale: [1, 1.14, 1], rotate: [0, 9, 0] }} transition={loop(2.6)}
      />
      <motion.path
        d="m18.5 15.5.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2Z"
        style={org(18.5, 18.5)} animate={{ opacity: [0.15, 1, 0.15], scale: [0.75, 1.15, 0.75] }} transition={loop(2.6, 1.3)}
      />
    </>
  ),
  pulse: (
    <motion.path
      d="M3 12.2h3.8L9.4 6l4.3 12 2.5-5.8H21"
      initial={{ pathLength: 0 }}
      animate={{ pathLength: [0, 1, 1], opacity: [1, 1, 0] }}
      transition={loop(2.4, 0, { times: [0, 0.62, 1], ease: 'linear' })}
    />
  ),
  home: (
    <motion.g style={org()} animate={{ y: [0, -0.8, 0] }} transition={loop(3.2)}>
      <path d="M4 11.3 12 4.3l8 7" />
      <path d="M6.3 9.8v9.7h11.4V9.8" />
    </motion.g>
  ),
  grid: (
    <>
      {[['4', '4'], ['13', '4'], ['4', '13'], ['13', '13']].map(([x, y], i) => (
        <motion.rect
          key={i} x={x} y={y} width="7" height="7" rx="1.6"
          animate={{ opacity: [0.35, 1, 0.35] }} transition={loop(2.4, i * 0.3)}
        />
      ))}
    </>
  ),
  wave: (
    <motion.path
      d="M3 14.5c2.5-5 4.5-5 6 0s3.5 5 6 0 3.7-4.6 6-1.5"
      initial={{ pathLength: 0 }} animate={{ pathLength: [0, 1, 1], opacity: [1, 1, 0] }}
      transition={loop(2.6, 0, { times: [0, 0.6, 1] })}
    />
  ),
};

export function LiveGlyph({ name, size = 24, strokeWidth = 1.7, active = true }) {
  if (!active || !LIVE[name]) return <Icon name={name} size={size} strokeWidth={strokeWidth} />;
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true" style={{ overflow: 'visible' }}
    >
      {LIVE[name]}
    </svg>
  );
}
