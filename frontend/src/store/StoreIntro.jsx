import React, { useCallback, useEffect, useRef } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import './storeIntro.css';

const INTRO_ARTIFACTS = [
  {
    src: '/images/store/intro-ceramic.webp',
    alt: 'Лазурный керамический сосуд в традициях Узбекистана',
    label: 'Лазурная керамика',
    era: 'XII–XIV вв.',
  },
  {
    src: '/images/store/intro-bronze-ewer.webp',
    alt: 'Старинный бронзовый кумган Центральной Азии',
    label: 'Бронзовый кумган',
    era: 'Шёлковый путь',
  },
  {
    src: '/images/store/intro-silver-amulet.webp',
    alt: 'Серебряный амулет с сердоликом в узбекской традиции',
    label: 'Серебро и сердолик',
    era: 'XIX век',
  },
];

const artifactMotion = {
  hidden: (index) => ({
    opacity: 0,
    y: index === 1 ? 110 : 70,
    x: index === 0 ? -70 : index === 2 ? 70 : 0,
    rotate: index === 0 ? -8 : index === 2 ? 7 : 0,
    scale: 0.78,
    filter: 'blur(10px)',
  }),
  visible: (index) => ({
    opacity: index === 1 ? 1 : 0.78,
    y: 0,
    x: 0,
    rotate: index === 0 ? -3 : index === 2 ? 3 : 0,
    scale: index === 1 ? 1 : 0.92,
    filter: 'blur(0px)',
    transition: {
      delay: 0.15 + index * 0.18,
      duration: 1.05,
      ease: [0.16, 1, 0.3, 1],
    },
  }),
};

export default function StoreIntro({ open, onComplete }) {
  const reduceMotion = useReducedMotion();
  const completedRef = useRef(false);
  const skipButtonRef = useRef(null);

  const finish = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    onComplete();
  }, [onComplete]);

  useEffect(() => {
    if (!open) return undefined;
    completedRef.current = false;
    skipButtonRef.current?.focus({ preventScroll: true });
    const timeout = window.setTimeout(finish, reduceMotion ? 650 : 3600);
    return () => window.clearTimeout(timeout);
  }, [finish, open, reduceMotion]);

  return (
    <AnimatePresence>
      {open && (
        <motion.section
          className="store-intro"
          data-testid="store-intro"
          aria-label="Знакомство с коллекцией ART Store"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.025, filter: 'blur(8px)' }}
          transition={{ duration: reduceMotion ? 0.08 : 0.72, ease: [0.65, 0, 0.35, 1] }}
        >
          <div className="store-intro-ambient" aria-hidden="true" />
          <div className="store-intro-topline">
            <span>Ташкент · Узбекистан</span>
            <button ref={skipButtonRef} type="button" onClick={finish} aria-label="Пропустить заставку">
              Пропустить <i aria-hidden="true">↗</i>
            </button>
          </div>

          <div className="store-intro-stage">
            {INTRO_ARTIFACTS.map((artifact, index) => (
              <motion.figure
                className={`store-intro-artifact store-intro-artifact-${index + 1}`}
                custom={index}
                variants={artifactMotion}
                initial={reduceMotion ? 'visible' : 'hidden'}
                animate="visible"
                key={artifact.src}
              >
                <img src={artifact.src} alt={artifact.alt} />
                <motion.figcaption
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: reduceMotion ? 0 : 1.05 + index * 0.12, duration: 0.5 }}
                >
                  <span>{artifact.label}</span>
                  <small>{artifact.era}</small>
                </motion.figcaption>
              </motion.figure>
            ))}

            <motion.div
              className="store-intro-signature"
              initial={{ opacity: 0, y: 26 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: reduceMotion ? 0 : 1.15, duration: 0.95, ease: [0.16, 1, 0.3, 1] }}
            >
              <p>Артефакты · искусство · редкие истории</p>
              <div className="store-intro-brand" aria-label="ART * Store">
                <span>ART</span><i aria-hidden="true">*</i><em>Store</em>
              </div>
            </motion.div>
          </div>

          <div className="store-intro-progress" aria-hidden="true">
            <motion.i
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: reduceMotion ? 0.5 : 3.35, ease: 'linear' }}
            />
          </div>
        </motion.section>
      )}
    </AnimatePresence>
  );
}
