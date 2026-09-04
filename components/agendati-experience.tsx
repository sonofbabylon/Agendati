"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowRight, CalendarDays, CheckCircle2, Languages, Layers3, Presentation } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CalendarWorkspace } from "@/components/calendar-workspace";
import { translate, type AppLocale } from "@/lib/i18n";

function AgendatiWordmark() {
  return <span className="agendati-wordmark"><span className="agendati-mark"><i /><i /><i /><i /></span>Agendati<span>.</span></span>;
}

export function AgendatiExperience() {
  const [locale, setLocale] = useState<AppLocale>("en");
  const storyRef = useRef<HTMLElement>(null);
  const t = (text: string) => translate(locale, text);
  const openApp = () => document.querySelector("#agendati-workspace")?.scrollIntoView({ behavior: "smooth", block: "start" });
  const explore = () => document.querySelector("#agendati-story")?.scrollIntoView({ behavior: "smooth", block: "start" });

  useEffect(() => {
    const saved = localStorage.getItem("agendati-language");
    if (saved === "ar") queueMicrotask(() => setLocale("ar"));
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
    localStorage.setItem("agendati-language", locale);
  }, [locale]);

  useEffect(() => {
    const section = storyRef.current;
    if (!section) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    const clamp = (value: number) => Math.min(1, Math.max(0, value));
    const ease = (value: number) => value * value * (3 - 2 * value);
    const stage = (progress: number, start: number, duration: number) => ease(clamp((progress - start) / duration));
    const set = (name: string, value: string | number) => section.style.setProperty(name, String(value));

    const render = () => {
      frame = 0;
      if (reducedMotion.matches) {
        section.classList.remove("story-motion");
        return;
      }

      const rect = section.getBoundingClientRect();
      const viewport = window.innerHeight;
      const progress = clamp((viewport * 0.82 - rect.top) / (viewport * 0.95));
      const number = stage(progress, 0, 0.2);
      const kicker = stage(progress, 0.03, 0.2);
      const lineOne = stage(progress, 0.08, 0.22);
      const lineTwo = stage(progress, 0.14, 0.22);
      const cards = [stage(progress, 0.27, 0.24), stage(progress, 0.41, 0.24), stage(progress, 0.55, 0.24)];
      const action = stage(progress, 0.74, 0.2);
      const narrow = window.innerWidth <= 900;
      const direction = locale === "ar" ? -1 : 1;

      section.classList.add("story-motion");
      set("--story-number-opacity", number.toFixed(3));
      set("--story-number-x", `${-48 * direction * (1 - number)}px`);
      set("--story-number-rotate", `${-7 * (1 - number)}deg`);
      set("--story-kicker-opacity", kicker.toFixed(3));
      set("--story-kicker-y", `${22 * (1 - kicker)}px`);
      set("--story-line-one-opacity", lineOne.toFixed(3));
      set("--story-line-one-y", `${70 * (1 - lineOne)}px`);
      set("--story-line-two-opacity", lineTwo.toFixed(3));
      set("--story-line-two-y", `${70 * (1 - lineTwo)}px`);

      cards.forEach((value, index) => {
        const finalX = index === 1 && !narrow ? -28 * direction : 0;
        set(`--story-card-${index + 1}-opacity`, value.toFixed(3));
        set(`--story-card-${index + 1}-x`, `${finalX + 82 * direction * (1 - value)}px`);
        set(`--story-card-${index + 1}-y`, `${48 * (1 - value)}px`);
        set(`--story-card-${index + 1}-rotate`, `${5 * (1 - value)}deg`);
        set(`--story-card-${index + 1}-scale`, (0.9 + value * 0.1).toFixed(3));
        set(`--story-card-${index + 1}-blur`, `${10 * (1 - value)}px`);
      });

      set("--story-action-opacity", action.toFixed(3));
      set("--story-action-y", `${30 * (1 - action)}px`);
    };

    const queueRender = () => {
      if (!frame) frame = window.requestAnimationFrame(render);
    };

    render();
    window.addEventListener("scroll", queueRender, { passive: true });
    window.addEventListener("resize", queueRender);
    reducedMotion.addEventListener("change", queueRender);

    return () => {
      window.removeEventListener("scroll", queueRender);
      window.removeEventListener("resize", queueRender);
      reducedMotion.removeEventListener("change", queueRender);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [locale]);

  return <div className={`agendati-experience ${locale === "ar" ? "is-arabic" : ""}`} lang={locale} dir={locale === "ar" ? "rtl" : "ltr"}>
    <section className="agendati-simple-hero" aria-labelledby="agendati-title">
      <header className="hero-navigation">
        <AgendatiWordmark />
        <div className="hero-nav-actions">
          <button onClick={explore}>{t("How it works")}</button>
          <Button variant="outline" className="glass-button language-toggle" onClick={() => setLocale(locale === "en" ? "ar" : "en")} aria-label={locale === "en" ? "Switch to Arabic" : "التبديل إلى الإنجليزية"}><Languages />{locale === "en" ? "العربية" : "English"}</Button>
          <Button className="glass-button glass-button-dark" onClick={openApp}>{t("Open calendar")}<ArrowRight /></Button>
        </div>
      </header>

      <div className="simple-hero-inner">
        <div className="simple-hero-copy">
          <span className="simple-hero-eyebrow">{t("CALENDAR · WORKFLOW · EXPORT")}</span>
          <h1 id="agendati-title">{t("Plan the month.")}<br /><span>{t("Share it beautifully.")}</span></h1>
          <p>{t("Agendati brings events, approvals, and presentation-ready exports into one calm workspace.")}</p>
          <div className="simple-hero-actions">
            <Button className="glass-button glass-button-dark" onClick={openApp}>{t("Open calendar")}<ArrowRight /></Button>
            <Button variant="outline" className="glass-button" onClick={explore}>{t("See how it works")}<ArrowDown /></Button>
          </div>
          <div className="simple-hero-proof" aria-label="Agendati workflow">
            <span>{t("Plan")}</span><i />
            <span>{t("Approve")}</span><i />
            <span>{t("Export")}</span>
          </div>
        </div>

        <div className="device-showcase" aria-label="Agendati calendar exports shown on laptop, tablet, and phone">
          <Image
            src="/agendati-device-showcase.png"
            alt="Agendati monthly calendar exports displayed on a laptop, tablet, and phone"
            width={1536}
            height={1152}
            priority
          />
        </div>
      </div>
      <div className="simple-hero-fade" />
    </section>

    <section className="agendati-story" id="agendati-story" ref={storyRef}>
      <div className="story-sticky">
        <span className="story-number">02</span>
        <div className="story-heading"><span>{t("FROM AN IDEA TO A SHARED MONTH")}</span><h2><span>{t("Every step,")}</span><span>{t("in one rhythm.")}</span></h2></div>
        <div className="story-cards">
          <article><span><CalendarDays />01</span><h3>{t("Plan clearly")}</h3><p>{t("Start with the essentials. Add workflow details only when the event actually needs them.")}</p></article>
          <article><span><CheckCircle2 />02</span><h3>{t("Decide quickly")}</h3><p>{t("Reviewers see the event, its context, and the next action without searching through settings.")}</p></article>
          <article><span><Presentation />03</span><h3>{t("Share beautifully")}</h3><p>{t("Turn the live calendar into presentation-ready desktop and phone visuals in a few taps.")}</p></article>
        </div>
        <Button className="glass-button story-cta" onClick={openApp}><Layers3 />{t("Enter your workspace")}<ArrowDown /></Button>
      </div>
    </section>

    <section className="workspace-entry" id="agendati-workspace">
      <div className="workspace-intro"><span>03 · {t("YOUR WORKSPACE")}</span><p>{t("Everything below is live and ready to use.")}</p></div>
      <CalendarWorkspace locale={locale} />
    </section>
  </div>;
}
