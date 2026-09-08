"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "motion/react";
import { MarkGithubIcon } from "@primer/octicons-react";
import {
  ArrowUpRight,
  Command,
  FileDown,
  Highlighter,
  ImageIcon,
  Link2,
  Search,
  Table2,
} from "lucide-react";
import { publicPath } from "@/lib/public-path";
import styles from "./landing.module.css";

const githubUrl = process.env.NEXT_PUBLIC_NOTATION_GITHUB_URL || "https://github.com/Code-Wizard-Wilson/Notation";

const reveal = {
  hidden: { opacity: 0, y: 26 },
  visible: { opacity: 1, y: 0 },
};


const features = [
  { icon: Command, label: "Keyboard first", copy: "Create, search and move through notes without leaving the keyboard." },
  { icon: Highlighter, label: "Rich text, quietly", copy: "Typefaces, markers, links and block controls only appear when you need them." },
  { icon: Table2, label: "Real tables", copy: "Editable rows and columns inside the same clean writing surface." },
  { icon: ImageIcon, label: "Images that behave", copy: "Drop them in, resize them, move them and keep the page calm." },
  { icon: Link2, label: "Notes connect", copy: "Wiki links and backlinks turn a folder of notes into a useful map." },
  { icon: FileDown, label: "Your data leaves cleanly", copy: "Export Markdown or a proper PDF whenever you want." },
];

function BrandMark() {
  return (
    <span className={styles.brandMark} aria-hidden="true">
      <Image src={publicPath("/icon.svg")} alt="" width={64} height={64} unoptimized />
    </span>
  );
}

function VerifiedSeal() {
  return (
    <svg className={styles.verifiedSeal} viewBox="0 0 32 32" aria-hidden="true">
      <g className={styles.verifiedRingSpin}>
        <path
          className={styles.verifiedRing}
          d="M16 2.8L18.85 5.37L22.6 4.57L23.78 8.22L27.43 9.4L26.63 13.15L29.2 16L26.63 18.85L27.43 22.6L23.78 23.78L22.6 27.43L18.85 26.63L16 29.2L13.15 26.63L9.4 27.43L8.22 23.78L4.57 22.6L5.37 18.85L2.8 16L5.37 13.15L4.57 9.4L8.22 8.22L9.4 4.57L13.15 5.37Z"
        />
      </g>
      <path className={styles.verifiedCheck} d="M11 16.1l3.2 3.15 7-7.6" />
    </svg>
  );
}

export default function LandingPage() {
  return (
    <main className={styles.page}>
      <header className={styles.navWrap}>
        <nav className={styles.nav} aria-label="Landing navigation">
          <Link href="/" className={styles.brand}>
            <BrandMark />
            <span>Notation</span>
          </Link>
          <div className={styles.navLinks}>
            <a href="#features">Features</a>
            <a href="#workflow">Workflow</a>
            <a href={githubUrl} target="_blank" rel="noreferrer">GitHub</a>
          </div>
          <div className={styles.navActions}>
            <a href={githubUrl} target="_blank" rel="noreferrer" className={styles.navCta}>
              <MarkGithubIcon size={15} aria-hidden="true" />
              <span>Get it</span>
            </a>
          </div>
        </nav>
      </header>

      <section className={styles.hero}>
        <motion.div
          className={styles.heroCopy}
          initial={{ opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.72, ease: [0.16, 1, 0.3, 1] }}
        >
          <h1>
            Write before the
            <span className={styles.heroAccent}> thought disappears.</span>
          </h1>
          <p>
            A fast, focused notes app with rich blocks, Markdown, backlinks and just enough interface to stay out of your way.
          </p>
          <div className={styles.heroActions}>
            <a href={githubUrl} target="_blank" rel="noreferrer" className={styles.primaryCta}>
              <MarkGithubIcon size={19} aria-hidden="true" />
              <span>Get it now on GitHub</span>
              <ArrowUpRight size={16} />
            </a>
          </div>
        </motion.div>

        <motion.div
          className={styles.heroVisualWrap}
          initial={{ opacity: 0, y: 42, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.92, delay: 0.12, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className={styles.heroVisual}>
            <Image
              src={publicPath("/landing/editor.png")}
              alt="Notation editor showing a product direction note"
              width={2880}
              height={1800}
              priority
              unoptimized
              className={styles.heroImage}
            />
          </div>
        </motion.div>
      </section>

      <section className={styles.statement} id="workflow">
        <motion.div
          className={styles.statementInner}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.35 }}
          variants={reveal}
          transition={{ duration: 0.66, ease: [0.16, 1, 0.3, 1] }}
        >
          <h2>The interface should disappear when the sentence starts.</h2>
          <p>No permanent formatting jungle. Select text and the tools arrive. Move away and they are gone.</p>
        </motion.div>
      </section>

      <section className={styles.bento} id="features">
        <motion.article
          className={`${styles.bentoCard} ${styles.searchCard}`}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          variants={reveal}
          transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className={styles.cardHead}>
            <div>
              <h3>Search without breaking focus.</h3>
            </div>
            <span className={styles.iconPill}><Search size={18} /></span>
          </div>
          <p>One compact palette for notes and actions. Fewer panels, fewer context switches.</p>
          <div className={styles.shotFrame}>
            <Image src={publicPath("/landing/search-custom.png")} alt="Notation command palette" width={1440} height={900} className={styles.searchShot} />
          </div>
        </motion.article>

        <motion.article
          className={`${styles.bentoCard} ${styles.openSourceCard}`}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          variants={reveal}
          transition={{ duration: 0.65, delay: 0.06, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className={styles.openSourceTop}>
            <div>
              <h3>Open source.<br />Fully yours.</h3>
              <p>Clone it, fork it, change anything. No lock-in and no black box.</p>
            </div>
          </div>

          <div className={styles.verifiedModel} aria-hidden="true">
            <VerifiedSeal />
          </div>
        </motion.article>

      </section>

      <section className={styles.featureGrid}>
        {features.map((feature, index) => {
          const Icon = feature.icon;
          return (
            <motion.article
              key={feature.label}
              className={styles.feature}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.25 }}
              variants={reveal}
              transition={{ duration: 0.55, delay: index * 0.035, ease: [0.16, 1, 0.3, 1] }}
            >
              <span className={styles.featureIcon}><Icon size={18} /></span>
              <h3>{feature.label}</h3>
              <p>{feature.copy}</p>
            </motion.article>
          );
        })}
      </section>

      <section className={styles.finalCta}>
        <motion.div
          className={styles.finalInner}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.35 }}
          variants={reveal}
          transition={{ duration: 0.72, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className={styles.finalOrb} aria-hidden="true"><BrandMark /></div>
          <span className={styles.sectionIndex}>OPEN SOURCE</span>
          <h2>Keep the note.<br />Lose the noise.</h2>
          <p>Clone it, change it, make it yours.</p>
          <a href={githubUrl} target="_blank" rel="noreferrer" className={styles.finalButton}>
            <MarkGithubIcon size={20} aria-hidden="true" />
            <span>Get it now on GitHub</span>
            <ArrowUpRight size={16} />
          </a>
        </motion.div>
      </section>

      <footer className={styles.footer}>
        <Link href="/" className={styles.brand}><BrandMark /><span>Notation</span></Link>
        <p>Built for notes, not dashboards.</p>
        <div>
          <a href={githubUrl} target="_blank" rel="noreferrer">GitHub</a>
        </div>
      </footer>
    </main>
  );
}
