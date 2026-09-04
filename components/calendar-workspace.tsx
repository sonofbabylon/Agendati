"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState, type CSSProperties, type Dispatch, type ReactNode, type SetStateAction } from "react";
import Image from "next/image";
import {
  ArrowLeft, ArrowRight, CalendarDays, Check, CheckCircle2, ChevronLeft, ChevronRight,
  CircleDot, Clock3, Copy, Download, FileImage, FileText, Layers, LayoutGrid, List,
  MapPin, Monitor, Palette, Pencil, Plus, RotateCcw, Search, Settings2,
  Share2, SlidersHorizontal, Sparkles, Smartphone, Trash2, UserRound, Workflow,
} from "lucide-react";
import { toast, Toaster } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DEFAULT_APP_STATE, addActivity, normalizeState, uid, type AppEvent, type AppState,
  type EventTypeConfig, type WorkflowConfig,
} from "@/lib/app-model";
import {
  DEFAULT_DESIGN, MONTHS, MONTH_PALETTES, PALETTES, dateKey, dayOffset, daysInMonth,
  eventsForMonth, type Design,
} from "@/lib/calendar-data";
import { artworkPng, createArtwork, downloadFile, svgUrl, type Artwork } from "@/lib/artwork";
import { dateLocale, monthLabel, translate, type AppLocale } from "@/lib/i18n";

type Section = "calendar" | "approvals" | "studio" | "settings";
type CalendarView = "month" | "agenda" | "year";

const STATUS_OPTIONS = ["All statuses", "Draft", "In review", "Published", "Completed", "Cancelled"];
const fieldClass = "app-field";
const STORAGE_KEY = "agendati-workspace-v1";
const LocaleContext = createContext<AppLocale>("en");

function useI18n() {
  const locale = useContext(LocaleContext);
  return { locale, t: (text: string) => translate(locale, text) };
}

function Choice({ value, onChange, options, label }: { value: string; onChange: (value: string) => void; options: { value: string; label: string }[]; label: string }) {
  return <Select value={value} onValueChange={onChange}><SelectTrigger className={fieldClass} aria-label={label}><SelectValue /></SelectTrigger><SelectContent>{options.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent></Select>;
}

function BrandMark() {
  return <span className="workspace-brand"><span className="brand-grid"><i /><i /><i /><i /></span><span>Agendati<span>.</span></span></span>;
}

function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <label className="app-toggle"><span>{label}</span><Switch checked={checked} onCheckedChange={onChange} aria-label={label} /></label>;
}

function EmptyState({ title, copy, action }: { title: string; copy: string; action?: ReactNode }) {
  return <div className="new-empty"><CalendarDays /><strong>{title}</strong><p>{copy}</p>{action}</div>;
}

function workflowFor(event: AppEvent, state: AppState) {
  return state.workflows.find((item) => item.id === event.workflowId) || state.workflows[0];
}

function eventStatus(event: AppEvent, workflow: WorkflowConfig) {
  if (event.status === "Cancelled") return "Cancelled";
  if (event.stageId === "Draft") return "Draft";
  if (workflow.approvalStage === event.stageId) return "In review";
  if (event.stageId === "Completed") return "Completed";
  return "Published";
}

function blankEvent(year: number, month: number, day = 1, state = DEFAULT_APP_STATE): AppEvent {
  const type = state.eventTypes[0];
  const workflow = state.workflows.find((item) => item.id === type.workflowId) || state.workflows[0];
  return {
    id: "", title: "", date: dateKey(year, month, day), time: "09:00", end: "10:00",
    type: type.name, location: "", status: "Draft", description: "", audience: "",
    organizer: "", capacity: undefined, workflowId: workflow.id, stageId: "Draft", activity: [],
  };
}

function formatDate(value: string, locale: AppLocale, withYear = false) {
  return new Intl.DateTimeFormat(dateLocale(locale), { weekday: "short", day: "numeric", month: "short", ...(withYear ? { year: "numeric" } : {}), timeZone: "UTC" }).format(new Date(`${value}T12:00:00Z`));
}

function StageTrack({ event, state }: { event: AppEvent; state: AppState }) {
  const { t } = useI18n();
  const workflow = workflowFor(event, state);
  const current = Math.max(0, workflow.stages.indexOf(event.stageId));
  return <div className="stage-track" aria-label={`${t(workflow.name)}: ${t(event.stageId)}`}>
    {workflow.stages.map((stage, index) => <div key={stage} className={index < current ? "done" : index === current ? "current" : ""}><span>{index < current ? <Check size={11} /> : index + 1}</span><small>{t(stage)}</small></div>)}
  </div>;
}

export function CalendarWorkspace({ locale = "en" }: { locale?: AppLocale }) {
  return <LocaleContext.Provider value={locale}><CalendarWorkspaceContent /></LocaleContext.Provider>;
}

function CalendarWorkspaceContent() {
  const { locale, t } = useI18n();
  const [state, setState] = useState<AppState>(DEFAULT_APP_STATE);
  const restored = useRef(false);
  const [section, setSection] = useState<Section>("calendar");
  const [calendarView, setCalendarView] = useState<CalendarView>("month");
  const [year, setYear] = useState(2026);
  const [month, setMonth] = useState(8);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All statuses");
  const [typeFilter, setTypeFilter] = useState("All types");
  const [editor, setEditor] = useState<AppEvent | null>(null);
  const [editorStep, setEditorStep] = useState(1);
  const [detail, setDetail] = useState<AppEvent | null>(null);
  const [brief, setBrief] = useState("");
  const [exportOpen, setExportOpen] = useState(false);
  const [typeDialog, setTypeDialog] = useState<EventTypeConfig | null>(null);
  const [workflowDialog, setWorkflowDialog] = useState<WorkflowConfig | null>(null);

  useEffect(() => {
    let saved = DEFAULT_APP_STATE;
    try { saved = normalizeState(JSON.parse(localStorage.getItem(STORAGE_KEY) || localStorage.getItem("monthly-workspace-v2") || "null")); }
    catch { toast.error(document.documentElement.lang === "ar" ? "تعذّرت استعادة التقويم المحفوظ." : "We could not restore your saved calendar."); }
    queueMicrotask(() => { setState(saved); restored.current = true; });
  }, []);

  useEffect(() => {
    if (!restored.current) return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
    catch { toast.error(locale === "ar" ? "تعذّر حفظ التغييرات على هذا الجهاز." : "Changes could not be saved on this device."); }
  }, [state, locale]);

  const monthEvents = useMemo(() => state.events
    .filter((event) => event.date.startsWith(`${year}-${String(month + 1).padStart(2, "0")}`))
    .filter((event) => typeFilter === "All types" || event.type === typeFilter)
    .filter((event) => statusFilter === "All statuses" || event.status === statusFilter)
    .filter((event) => `${event.title} ${event.location} ${event.organizer}`.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time)), [state.events, year, month, typeFilter, statusFilter, search]);

  const pending = state.events.filter((event) => workflowFor(event, state).approvalStage === event.stageId && event.status !== "Cancelled");
  const drafts = state.events.filter((event) => event.stageId === "Draft" && event.status !== "Cancelled");

  function moveMonth(step: number) {
    const next = new Date(Date.UTC(year, month + step, 1));
    setYear(next.getUTCFullYear()); setMonth(next.getUTCMonth());
  }

  function openNew(day = 1) {
    setBrief(""); setEditorStep(1); setEditor(blankEvent(year, month, day, state));
  }

  function openEdit(event: AppEvent) {
    setDetail(null); setBrief(""); setEditorStep(1); setEditor({ ...event, activity: [...event.activity] });
  }

  function saveEvent(event: AppEvent, submit: boolean) {
    if (!event.title.trim() || !event.date || !event.time || !event.end) { toast.error(locale === "ar" ? "أضف العنوان والتاريخ والوقت." : "Add a title, date, and time."); return; }
    if (event.end <= event.time) { toast.error(locale === "ar" ? "يجب أن يكون وقت الانتهاء بعد وقت البدء." : "The end time must be after the start time."); return; }
    const workflow = state.workflows.find((item) => item.id === event.workflowId) || state.workflows[0];
    const existing = state.events.find((item) => item.id === event.id);
    let next = { ...event, id: event.id || uid(), title: event.title.trim() };
    if (!existing) next.activity = [{ id: uid(), at: new Date().toISOString(), text: "Event created" }];
    if (submit) {
      const nextStage = workflow.stages[1] || workflow.stages[0];
      next = addActivity({ ...next, stageId: nextStage }, `Submitted to ${nextStage}`);
    }
    next.status = eventStatus(next, workflow);
    setState((current) => ({ ...current, events: [...current.events.filter((item) => item.id !== next.id), next] }));
    setEditor(null); setDetail(next);
    toast.success(submit ? (workflow.approvalStage ? (locale === "ar" ? "أُرسلت للمراجعة" : "Sent for review") : (locale === "ar" ? "تمت جدولة الفعالية" : "Event scheduled")) : (locale === "ar" ? "تم حفظ المسودة" : "Draft saved"));
  }

  function updateEvent(next: AppEvent, message: string) {
    const updated = addActivity(next, message);
    setState((current) => ({ ...current, events: current.events.map((item) => item.id === updated.id ? updated : item) }));
    setDetail(updated); toast.success(message);
  }

  function advanceEvent(event: AppEvent, message?: string) {
    const workflow = workflowFor(event, state);
    const index = workflow.stages.indexOf(event.stageId);
    const stageId = workflow.stages[Math.min(index + 1, workflow.stages.length - 1)];
    const next = { ...event, stageId };
    next.status = eventStatus(next, workflow);
    updateEvent(next, message || `Moved to ${stageId}`);
  }

  function removeEvent(event: AppEvent) {
    setState((current) => ({ ...current, events: current.events.filter((item) => item.id !== event.id) }));
    setDetail(null); toast(locale === "ar" ? "تم حذف الفعالية" : "Event deleted", { action: { label: locale === "ar" ? "تراجع" : "Undo", onClick: () => setState((current) => ({ ...current, events: [...current.events, event] })) } });
  }

  return <div className={`workspace-app ${locale === "ar" ? "workspace-rtl" : ""}`} lang={locale} dir={locale === "ar" ? "rtl" : "ltr"}><Toaster richColors position="bottom-center" />
    <header className="workspace-header">
      <button className="brand-button" onClick={() => setSection("calendar")}><BrandMark /></button>
      <nav aria-label={t("Main navigation")}>
        {([
          ["calendar", "Calendar", CalendarDays], ["approvals", "Approvals", CheckCircle2],
          ["studio", "Export", Palette], ["settings", "Settings", Settings2],
        ] as const).map(([id, label, Icon]) => <button key={id} className={section === id ? "active" : ""} onClick={() => setSection(id)}><Icon />{t(label)}{id === "approvals" && pending.length > 0 && <span className="nav-count">{pending.length}</span>}</button>)}
      </nav>
      <div className="workspace-header-actions"><Button className="desktop-new" onClick={() => openNew()}><Plus />{t("New event")}</Button><span className="workspace-avatar">AM</span></div>
    </header>

    {section === "calendar" && <CalendarSection state={state} year={year} month={month} view={calendarView} events={monthEvents} search={search} statusFilter={statusFilter} typeFilter={typeFilter} onSearch={setSearch} onStatus={setStatusFilter} onType={setTypeFilter} onView={setCalendarView} onMove={moveMonth} onNew={openNew} onOpen={setDetail} />}
    {section === "approvals" && <ApprovalsSection state={state} pending={pending} drafts={drafts} onOpen={setDetail} onApprove={(event) => advanceEvent(event, locale === "ar" ? "تم الاعتماد والانتقال إلى المرحلة التالية" : "Approved and moved forward")} onChanges={(event) => updateEvent({ ...event, stageId: "Draft", status: "Draft" }, locale === "ar" ? "طُلبت تعديلات وأُعيدت الفعالية إلى المسودة" : "Changes requested; returned to draft")} />}
    {section === "studio" && <ExportStudio state={state} setState={setState} year={year} month={month} onMove={moveMonth} onOpenExport={() => setExportOpen(true)} />}
    {section === "settings" && <SettingsSection state={state} setState={setState} onEditType={setTypeDialog} onEditWorkflow={setWorkflowDialog} />}

    <button className="mobile-new" aria-label={t("Create event")} onClick={() => openNew()}><Plus /></button>
    <EventEditor open={!!editor} event={editor} step={editorStep} brief={brief} state={state} setEvent={setEditor} setStep={setEditorStep} setBrief={setBrief} onClose={() => setEditor(null)} onSave={saveEvent} />
    <EventDetail event={detail} state={state} onClose={() => setDetail(null)} onEdit={openEdit} onAdvance={advanceEvent} onRemove={removeEvent} onDuplicate={(event) => { setDetail(null); setEditor({ ...event, id: "", title: `${event.title} ${locale === "ar" ? "(نسخة)" : "(copy)"}`, stageId: "Draft", status: "Draft", activity: [] }); setEditorStep(1); }} />
    <ExportDialog key={`${year}-${month}`} open={exportOpen} onClose={() => setExportOpen(false)} state={state} year={year} currentMonth={month} />
    <TypeDialog key={typeDialog?.id || "type-closed"} value={typeDialog} workflows={state.workflows} onClose={() => setTypeDialog(null)} onSave={(value) => { setState((current) => ({ ...current, eventTypes: [...current.eventTypes.filter((item) => item.id !== value.id), value] })); setTypeDialog(null); toast.success(locale === "ar" ? "تم حفظ نوع الفعالية" : "Event type saved"); }} />
    <WorkflowDialog key={workflowDialog?.id || "workflow-closed"} value={workflowDialog} onClose={() => setWorkflowDialog(null)} onSave={(value) => { setState((current) => ({ ...current, workflows: [...current.workflows.filter((item) => item.id !== value.id), value] })); setWorkflowDialog(null); toast.success(locale === "ar" ? "تم حفظ سير العمل" : "Workflow saved"); }} />
  </div>;
}

type CalendarProps = { state: AppState; year: number; month: number; view: CalendarView; events: AppEvent[]; search: string; statusFilter: string; typeFilter: string; onSearch: (v: string) => void; onStatus: (v: string) => void; onType: (v: string) => void; onView: (v: CalendarView) => void; onMove: (v: number) => void; onNew: (day?: number) => void; onOpen: (event: AppEvent) => void };

function CalendarSection(props: CalendarProps) {
  const { locale, t } = useI18n();
  const { state, year, month, view, events } = props;
  return <main className="main-surface">
    <div className="surface-heading"><div><span className="overline">{t("A CLEAR VIEW OF WHAT'S NEXT")}</span><h1>{t("Calendar")}</h1><p>{t("Find, plan, and move work forward from one place.")}</p></div><Button className="heading-new" onClick={() => props.onNew()}><Plus />{t("New event")}</Button></div>
    <div className="calendar-commandbar">
      <div className="month-navigation"><Button variant="outline" size="icon" aria-label={t("Previous month")} onClick={() => props.onMove(-1)}><ChevronLeft /></Button><h2>{monthLabel(locale, month)} <span>{year}</span></h2><Button variant="outline" size="icon" aria-label={t("Next month")} onClick={() => props.onMove(1)}><ChevronRight /></Button></div>
      <div className="commandbar-right"><label className="simple-search"><Search /><Input value={props.search} onChange={(e) => props.onSearch(e.target.value)} placeholder={t("Find an event…")} aria-label={t("Find an event")} /></label><Tabs value={view} onValueChange={(value) => props.onView(value as CalendarView)}><TabsList><TabsTrigger value="month"><LayoutGrid />{t("Month")}</TabsTrigger><TabsTrigger value="agenda"><List />{t("Agenda")}</TabsTrigger><TabsTrigger value="year"><CalendarDays />{t("Year")}</TabsTrigger></TabsList></Tabs></div>
    </div>
    <div className="filter-row"><Choice label={t("Filter by status")} value={props.statusFilter} onChange={props.onStatus} options={STATUS_OPTIONS.map((item) => ({ value: item, label: t(item) }))} /><Choice label={t("Filter by type")} value={props.typeFilter} onChange={props.onType} options={[{ value: "All types", label: t("All event types") }, ...state.eventTypes.map((item) => ({ value: item.name, label: t(item.name) }))]} /><button onClick={() => { props.onSearch(""); props.onStatus("All statuses"); props.onType("All types"); }}>{t("Clear filters")}</button><span>{locale === "ar" ? `${events.length} فعالية` : `${events.length} event${events.length === 1 ? "" : "s"}`}</span></div>
    {view === "month" && <MonthCalendar {...props} />}
    {view === "agenda" && <Agenda events={events} state={state} onOpen={props.onOpen} onNew={props.onNew} />}
    {view === "year" && <YearCalendar year={year} state={state} onOpenMonth={(value) => { const difference = value - month; props.onMove(difference); props.onView("month"); }} />}
    <footer className="surface-footer"><span>{t(state.settings.timeZone.replace("_", " "))} · {t("Saved on this device")}</span><span>{t("Tap a day to add something.")}</span></footer>
  </main>;
}

function MonthCalendar({ state, year, month, events, onNew, onOpen }: CalendarProps) {
  const { locale, t } = useI18n();
  const cells = Math.ceil((dayOffset(year, month) + daysInMonth(year, month)) / 7) * 7;
  return <div className="calendar-scroll"><div className="new-calendar-grid"><div className="new-week-heading">{["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map((day) => <span key={day}>{t(day)}</span>)}</div><div className="new-month-cells">
    {Array.from({ length: cells }, (_, index) => {
      const day = index - dayOffset(year, month) + 1;
      if (day < 1 || day > daysInMonth(year, month)) return <div className="new-date-cell muted-cell" key={index} />;
      const items = events.filter((event) => event.date === dateKey(year, month, day));
      return <div className={`new-date-cell ${index % 7 >= 5 ? "non-working" : ""}`} key={index}><button className="new-date-number" onClick={() => onNew(day)} aria-label={locale === "ar" ? `إضافة فعالية في ${day} ${monthLabel(locale, month)}` : `Add event on ${day} ${MONTHS[month]}`}>{day}<Plus /></button>{items.slice(0, 3).map((event) => {
        const type = state.eventTypes.find((item) => item.name === event.type);
        return <button key={event.id} className="new-calendar-event" style={{ "--event-color": type?.color || "#677565" } as CSSProperties} onClick={() => onOpen(event)}><strong>{t(event.title)}</strong><span>{event.time} · {t(event.stageId)}</span></button>;
      })}{items.length > 3 && <button className="more-events" onClick={() => onOpen(items[3])}>+{items.length - 3} {locale === "ar" ? "إضافية" : "more"}</button>}</div>;
    })}
  </div></div></div>;
}

function Agenda({ events, state, onOpen, onNew }: { events: AppEvent[]; state: AppState; onOpen: (event: AppEvent) => void; onNew: (day?: number) => void }) {
  const { locale, t } = useI18n();
  if (!events.length) return <EmptyState title={t("A clear month")} copy={t("No events match these filters yet.")} action={<Button variant="outline" onClick={() => onNew()}><Plus />{t("Add an event")}</Button>} />;
  return <div className="new-agenda">{events.map((event) => {
    const type = state.eventTypes.find((item) => item.name === event.type);
    return <button key={event.id} onClick={() => onOpen(event)}><span className="agenda-date">{event.date.slice(-2)}<small>{formatDate(event.date, locale).split(" ")[0]}</small></span><span className="agenda-info"><strong>{t(event.title)}</strong><small><Clock3 />{event.time}–{event.end}<MapPin />{event.location ? t(event.location) : t("Location to confirm")}</small></span><span className="type-pill" style={{ "--event-color": type?.color || "#677565" } as CSSProperties}>{t(event.type)}</span><span className={`clean-status ${event.status.toLowerCase().replaceAll(" ", "-")}`}>{t(event.status)}</span><ChevronRight /></button>;
  })}</div>;
}

function YearCalendar({ year, state, onOpenMonth }: { year: number; state: AppState; onOpenMonth: (month: number) => void }) {
  const { locale, t } = useI18n();
  const total = state.events.filter((event) => event.date.startsWith(String(year))).length;
  return <div className="year-view"><div className="year-title"><h2>{year}</h2><p>{locale === "ar" ? `${total} فعالية خلال السنة` : `${total} events across the year`}</p></div><div className="year-months">{MONTHS.map((name, month) => {
    const count = state.events.filter((event) => event.date.startsWith(`${year}-${String(month + 1).padStart(2, "0")}`)).length;
    return <button key={name} onClick={() => onOpenMonth(month)}><span>{String(month + 1).padStart(2, "0")}</span><strong>{monthLabel(locale, month)}</strong><small>{count ? (locale === "ar" ? `${count} فعالية` : `${count} event${count === 1 ? "" : "s"}`) : t("Open month")}</small><ArrowRight /></button>;
  })}</div></div>;
}

function ApprovalsSection({ state, pending, drafts, onOpen, onApprove, onChanges }: { state: AppState; pending: AppEvent[]; drafts: AppEvent[]; onOpen: (event: AppEvent) => void; onApprove: (event: AppEvent) => void; onChanges: (event: AppEvent) => void }) {
  const { locale, t } = useI18n();
  return <main className="main-surface narrow-surface"><div className="surface-heading approvals-heading"><div><span className="overline">{t("DECISIONS WITHOUT THE CHASING")}</span><h1>{t("Approvals")}</h1><p>{t("Everything awaiting a decision, with the context beside it.")}</p></div><div className="approval-summary"><strong>{pending.length}</strong><span>{t("need review")}</span></div></div>
    <section className="review-list"><div className="section-title"><h2>{t("Ready for review")}</h2><span>{pending.length}</span></div>{pending.length ? pending.map((event) => <article className="review-card" key={event.id}><button className="review-main" onClick={() => onOpen(event)}><span className="review-date">{event.date.slice(-2)}<small>{monthLabel(locale, Number(event.date.slice(5, 7)) - 1).slice(0, 3)}</small></span><span><small className="review-kicker">{t(event.type)} · {event.organizer || t("No owner")}</small><strong>{t(event.title)}</strong><p>{event.description ? t(event.description) : t("No description yet.")}</p><StageTrack event={event} state={state} /></span></button><div className="review-actions"><Button variant="outline" onClick={() => onChanges(event)}>{t("Request changes")}</Button><Button onClick={() => onApprove(event)}><Check />{t("Approve")}</Button></div></article>) : <EmptyState title={t("You’re all caught up")} copy={t("New submissions will appear here with their workflow context.")} />}</section>
    <section className="draft-list"><div className="section-title"><h2>{t("Still in draft")}</h2><span>{drafts.length}</span></div>{drafts.slice(0, 6).map((event) => <button key={event.id} onClick={() => onOpen(event)}><span className="draft-date">{formatDate(event.date, locale)}</span><strong>{t(event.title)}</strong><span>{event.organizer || t("No owner")}</span><ChevronRight /></button>)}</section>
  </main>;
}

function ExportStudio({ state, setState, year, month, onMove, onOpenExport }: { state: AppState; setState: Dispatch<SetStateAction<AppState>>; year: number; month: number; onMove: (step: number) => void; onOpenExport: () => void }) {
  const { locale, t } = useI18n();
  const design = state.design;
  const update = <K extends keyof Design>(key: K, value: Design[K]) => setState((current) => ({ ...current, design: { ...current.design, [key]: value } }));
  const types = state.eventTypes.map((item) => item.name);
  const events = eventsForMonth(state.events, year, month, types, "Published");
  const localizedEvents = events.map((event) => ({ ...event, title: t(event.title), location: t(event.location) }));
  const artwork = createArtwork(localizedEvents, year, month, { ...design, language: locale });
  const [page, setPage] = useState(0);
  const displayPage = Math.min(page, artwork.length - 1);
  const shown = artwork[displayPage];
  const palette = PALETTES[design.monthPalette ? MONTH_PALETTES[month] : design.palette];
  return <main className="main-surface studio-surface"><div className="surface-heading"><div><span className="overline">{t("YOUR MONTH, DESIGNED TO TRAVEL")}</span><h1>{t("Export studio")}</h1><p>{t("Turn the live schedule into presentation-ready visuals.")}</p></div><Button onClick={onOpenExport}><Download />{t("Download")}</Button></div>
    <div className="new-studio-layout"><aside className="studio-controls">
      <div className="panel-label"><SlidersHorizontal /><strong>{t("Make it yours")}</strong><button onClick={() => setState((current) => ({ ...current, design: DEFAULT_DESIGN }))} aria-label={t("Reset design")}><RotateCcw /></button></div>
      <div className="studio-group"><span>01 · {t("Month")}</span><div className="mini-month-nav"><button onClick={() => onMove(-1)}><ChevronLeft /></button><strong>{monthLabel(locale, month)} {year}</strong><button onClick={() => onMove(1)}><ChevronRight /></button></div><p>{locale === "ar" ? `${events.length} فعالية منشورة مضمّنة` : `${events.length} published event${events.length === 1 ? "" : "s"} included`}</p></div>
      <div className="studio-group"><span>02 · {t("Layout")}</span><div className="visual-choice"><button className={design.layout === "programme" ? "active" : ""} onClick={() => update("layout", "programme")}><i className="list-visual" /><strong>{t("Programme")}</strong><small>{t("Dates and details")}</small></button><button className={design.layout === "calendar" ? "active" : ""} onClick={() => update("layout", "calendar")}><i className="grid-visual" /><strong>{t("Calendar")}</strong><small>{t("Month at a glance")}</small></button></div></div>
      <div className="studio-group"><span>03 · {t("Colour")}</span><div className="palette-picker">{PALETTES.map((item, index) => <button key={item.name} className={!design.monthPalette && design.palette === index ? "active" : ""} style={{ background: item.bg, color: item.fg }} onClick={() => { update("palette", index); update("monthPalette", false); update("customBg", ""); update("customFg", ""); }} aria-label={`${item.name} palette`}>{!design.monthPalette && design.palette === index && <Check />}</button>)}</div><ToggleRow label={t("Seasonal colours by month")} checked={design.monthPalette} onChange={(value) => update("monthPalette", value)} /><div className="color-pair"><label>{t("Background")}<Input type="color" value={design.customBg || palette.bg} onChange={(event) => update("customBg", event.target.value)} /></label><label>{t("Text")}<Input type="color" value={design.customFg || palette.fg} onChange={(event) => update("customFg", event.target.value)} /></label></div></div>
      <div className="studio-group"><span>04 · {t("Details")}</span><div className="range-heading"><label>{t("Heading size")}</label><strong>{design.heading}%</strong></div><Slider min={70} max={115} value={[design.heading]} onValueChange={(value) => update("heading", value[0])} aria-label={t("Heading size")} /><div className="range-heading"><label>{t("Schedule text")}</label><strong>{design.fontSize}%</strong></div><Slider min={85} max={125} value={[design.fontSize]} onValueChange={(value) => update("fontSize", value[0])} aria-label={t("Schedule text")} /><ToggleRow label={t("Show event times")} checked={design.showTime} onChange={(value) => update("showTime", value)} /><ToggleRow label={t("Show locations")} checked={design.showLocation} onChange={(value) => update("showLocation", value)} /><ToggleRow label={t("Show mini calendar")} checked={design.showMini} onChange={(value) => update("showMini", value)} /><ToggleRow label={t("Show calendar name")} checked={design.showBrand} onChange={(value) => update("showBrand", value)} />{design.showBrand && <Input value={design.brand} onChange={(event) => update("brand", event.target.value)} maxLength={42} aria-label={t("Calendar name on artwork")} />}</div>
    </aside><section className="studio-workspace"><div className="studio-toolbar"><span><CircleDot />{t("Live preview")}</span><Tabs value={design.device} onValueChange={(value) => { update("device", value as Design["device"]); setPage(0); }}><TabsList><TabsTrigger value="desktop"><Monitor />{t("Desktop")}</TabsTrigger><TabsTrigger value="phone"><Smartphone />{t("Phone")}</TabsTrigger></TabsList></Tabs><small>{design.device === "desktop" ? "1920 × 1080" : "1080 × 1920"}</small></div><div className={`new-artboard-stage ${design.device}`}><div className="new-artboard"><Image unoptimized width={shown.width} height={shown.height} src={svgUrl(shown.svg)} alt={locale === "ar" ? `تصميم تقويم ${monthLabel(locale, month)} ${year}، الصفحة ${shown.page} من ${shown.pages}` : `${MONTHS[month]} ${year} calendar artwork, page ${shown.page} of ${shown.pages}`} /></div></div><div className="studio-footer"><span><CheckCircle2 />{t("Every scheduled date is included.")}</span><div><Button variant="ghost" size="icon" onClick={() => setPage((value) => Math.max(0, value - 1))} disabled={displayPage === 0}><ChevronLeft /></Button><span>{displayPage + 1} / {artwork.length}</span><Button variant="ghost" size="icon" onClick={() => setPage((value) => Math.min(artwork.length - 1, value + 1))} disabled={displayPage >= artwork.length - 1}><ChevronRight /></Button></div></div></section></div>
  </main>;
}

function SettingsSection({ state, setState, onEditType, onEditWorkflow }: { state: AppState; setState: Dispatch<SetStateAction<AppState>>; onEditType: (value: EventTypeConfig) => void; onEditWorkflow: (value: WorkflowConfig) => void }) {
  const { t } = useI18n();
  const [tab, setTab] = useState("general");
  const updateSettings = <K extends keyof AppState["settings"]>(key: K, value: AppState["settings"][K]) => setState((current) => ({ ...current, settings: { ...current.settings, [key]: value } }));
  return <main className="main-surface settings-surface"><div className="surface-heading"><div><span className="overline">{t("SET IT ONCE, KEEP IT SIMPLE")}</span><h1>{t("Settings")}</h1><p>{t("Shape the calendar around the way your team works.")}</p></div><span className="saved-label"><CheckCircle2 />{t("Saved automatically")}</span></div><div className="settings-layout"><aside><button className={tab === "general" ? "active" : ""} onClick={() => setTab("general")}><Settings2 />{t("Calendar preferences")}</button><button className={tab === "types" ? "active" : ""} onClick={() => setTab("types")}><Palette />{t("Event types")}</button><button className={tab === "workflows" ? "active" : ""} onClick={() => setTab("workflows")}><Workflow />{t("Workflow templates")}</button></aside><section className="settings-panel">
    {tab === "general" && <><div className="settings-panel-heading"><div><h2>{t("Calendar preferences")}</h2><p>{t("Defaults used when planning and displaying events.")}</p></div></div><div className="general-settings"><label>{t("Calendar name")}<Input value={state.settings.name} onChange={(event) => updateSettings("name", event.target.value)} /></label><div className="form-grid"><label>{t("Week starts")}<Choice value={state.settings.weekStart} onChange={(value) => updateSettings("weekStart", value as "Monday" | "Sunday")} label={t("Week starts")} options={[{ value: "Monday", label: t("Monday") }, { value: "Sunday", label: t("Sunday") }]} /></label><label>{t("Time zone")}<Input value={state.settings.timeZone} onChange={(event) => updateSettings("timeZone", event.target.value)} /></label></div><div><span className="field-heading">{t("Working days")}</span><div className="working-days">{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day, index) => <button key={day} className={state.settings.workingDays.includes(index) ? "active" : ""} onClick={() => updateSettings("workingDays", state.settings.workingDays.includes(index) ? state.settings.workingDays.filter((item) => item !== index) : [...state.settings.workingDays, index].sort())}>{t(day)}</button>)}</div></div><div className="form-grid"><label>{t("Workday starts")}<Input type="time" value={state.settings.workStart} onChange={(event) => updateSettings("workStart", event.target.value)} /></label><label>{t("Workday ends")}<Input type="time" value={state.settings.workEnd} onChange={(event) => updateSettings("workEnd", event.target.value)} /></label></div><div className="settings-note"><Sparkles /><p><strong>{t("Helpful, not restrictive.")}</strong> {t("These preferences highlight likely conflicts, but never stop you from scheduling an event.")}</p></div></div></>}
    {tab === "types" && <><div className="settings-panel-heading"><div><h2>{t("Event types")}</h2><p>{t("Give recurring kinds of work a colour and a suitable workflow.")}</p></div><Button onClick={() => onEditType({ id: uid(), name: "", color: "#47785f", workflowId: state.workflows[0].id })}><Plus />{t("Add type")}</Button></div><div className="type-management">{state.eventTypes.map((type) => <button key={type.id} onClick={() => onEditType({ ...type })}><i style={{ background: type.color }} /><span><strong>{t(type.name)}</strong><small>{t(state.workflows.find((item) => item.id === type.workflowId)?.name || "")}</small></span><Pencil /></button>)}</div></>}
    {tab === "workflows" && <><div className="settings-panel-heading"><div><h2>{t("Workflow templates")}</h2><p>{t("Use a short path for simple events and approval only when it adds value.")}</p></div><Button onClick={() => onEditWorkflow({ id: uid(), name: "", description: "", stages: ["Draft", "Published", "Completed"] })}><Plus />{t("Add workflow")}</Button></div><div className="workflow-management">{state.workflows.map((workflow) => <button key={workflow.id} onClick={() => onEditWorkflow({ ...workflow, stages: [...workflow.stages] })}><span><strong>{t(workflow.name)}</strong><small>{t(workflow.description)}</small></span><span className="workflow-stage-list">{workflow.stages.map((stage) => <i key={stage}>{t(stage)}</i>)}</span><Pencil /></button>)}</div></>}
  </section></div></main>;
}

function EventEditor({ open, event, step, brief, state, setEvent, setStep, setBrief, onClose, onSave }: { open: boolean; event: AppEvent | null; step: number; brief: string; state: AppState; setEvent: (value: AppEvent | null) => void; setStep: (value: number) => void; setBrief: (value: string) => void; onClose: () => void; onSave: (event: AppEvent, submit: boolean) => void }) {
  const { locale, t } = useI18n();
  if (!event) return null;
  const currentEvent = event;
  const workflow = workflowFor(event, state);
  const conflicts = state.events.filter((item) => item.id !== event.id && item.date === event.date && item.time < event.end && item.end > event.time && item.status !== "Cancelled");
  const change = <K extends keyof AppEvent>(key: K, value: AppEvent[K]) => setEvent({ ...event, [key]: value });
  function applyType(name: string) { const type = state.eventTypes.find((item) => item.name === name)!; setEvent({ ...currentEvent, type: name, workflowId: type.workflowId, stageId: "Draft", status: "Draft" }); }
  function draftFromBrief() {
    if (!brief.trim()) { toast(locale === "ar" ? "صِف الفعالية بجملة واحدة أولاً." : "Describe the event in one sentence first."); return; }
    const words = brief.trim();
    const type = state.eventTypes.find((item) => words.toLowerCase().includes(item.name.toLowerCase()) || words.includes(t(item.name))) || state.eventTypes.find((item) => (words.toLowerCase().includes("train") || words.includes("تدريب")) && item.name === "Training") || state.eventTypes[0];
    const time = words.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/)?.[0] || currentEvent.time;
    const start = Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
    const end = `${String(Math.floor((start + 90) / 60)).padStart(2, "0")}:${String((start + 90) % 60).padStart(2, "0")}`;
    setEvent({ ...currentEvent, title: words.replace(/\b(on|at)\b.*$/i, "").trim().slice(0, 90), description: words, type: type.name, workflowId: type.workflowId, time, end });
    toast.success(locale === "ar" ? "تم إنشاء المسودة — راجع التفاصيل." : "Draft created — check the details.");
  }
  return <Dialog open={open} onOpenChange={(value) => !value && onClose()}><DialogContent className="event-editor-dialog"><DialogTitle>{event.id ? t("Edit event") : t("Create an event")}</DialogTitle><DialogDescription>{step === 1 ? t("Start with the essentials. You can add context next.") : t("Add only the context this event needs.")}</DialogDescription><div className="editor-progress"><span className="active">1 · {t("Essentials")}</span><i /><span className={step === 2 ? "active" : ""}>2 · {t("Context")}</span></div>
    {step === 1 ? <div className="event-step"><button className="brief-trigger" type="button" onClick={() => document.querySelector<HTMLTextAreaElement>("#event-brief")?.focus()}><Sparkles /><span><strong>{t("Start with a quick brief")}</strong><small>{t("Describe it naturally, then review the draft.")}</small></span></button><div className="brief-box"><Textarea id="event-brief" value={brief} onChange={(e) => setBrief(e.target.value)} placeholder={t("e.g. A design workshop next Thursday at 10:00 for the product team")} /><Button type="button" variant="outline" onClick={draftFromBrief}>{t("Create draft")}</Button></div><label>{t("Event title")}<Input autoFocus={!brief} value={event.title} onChange={(e) => change("title", e.target.value)} placeholder={t("What’s happening?")} /></label><div className="form-grid"><label>{t("Event type")}<Choice value={event.type} onChange={applyType} label={t("Event type")} options={state.eventTypes.map((item) => ({ value: item.name, label: t(item.name) }))} /></label><label>{t("Date")}<Input lang="en" type="date" value={event.date} onChange={(e) => change("date", e.target.value)} /></label></div><div className="time-grid"><label>{t("Starts")}<Input lang="en" type="time" value={event.time} onChange={(e) => change("time", e.target.value)} /></label><span>{t("to")}</span><label>{t("Ends")}<Input lang="en" type="time" value={event.end} onChange={(e) => change("end", e.target.value)} /></label></div><label>{t("Location")}<Input value={event.location} onChange={(e) => change("location", e.target.value)} placeholder={t("Room, venue, or online")} /></label>{conflicts.length > 0 && <div className="conflict-banner"><Clock3 /><span><strong>{locale === "ar" ? `${conflicts.length} تعارض محتمل` : `${conflicts.length} possible overlap${conflicts.length > 1 ? "s" : ""}`}</strong><small>{conflicts.map((item) => t(item.title)).join(", ")}. {locale === "ar" ? "يمكنك المتابعة." : "You can still continue."}</small></span></div>}<div className="editor-actions"><span>{locale === "ar" ? "الخطوة 1 من 2" : "Step 1 of 2"}</span><Button onClick={() => { if (!event.title.trim()) { toast.error(locale === "ar" ? "أضف عنوان الفعالية أولاً." : "Add an event title first."); return; } setStep(2); }}>{t("Continue")}<ArrowRight /></Button></div></div>
    : <div className="event-step"><button className="back-step" onClick={() => setStep(1)}><ArrowLeft />{t("Back to essentials")}</button><label>{t("Description")}<Textarea value={event.description} onChange={(e) => change("description", e.target.value)} placeholder={t("What should people know?")} /></label><div className="form-grid"><label>{t("Audience")}<Input value={event.audience} onChange={(e) => change("audience", e.target.value)} placeholder={t("Who is it for?")} /></label><label>{t("Organizer")}<Input value={event.organizer} onChange={(e) => change("organizer", e.target.value)} placeholder={t("Who owns it?")} /></label></div><label>{t("Capacity (optional)")}<Input lang="en" type="number" min="1" value={event.capacity || ""} onChange={(e) => change("capacity", e.target.value ? Number(e.target.value) : undefined)} placeholder={t("No limit")} /></label><div className="workflow-preview"><Workflow /><span><strong>{t(workflow.name)}</strong><small>{t(workflow.description)}</small></span><StageTrack event={event} state={state} /></div><details className="advanced-details"><summary>{t("Advanced options")}</summary><label>{t("Workflow")}<Choice value={event.workflowId} onChange={(value) => setEvent({ ...event, workflowId: value, stageId: "Draft", status: "Draft" })} label={t("Workflow")} options={state.workflows.map((item) => ({ value: item.id, label: t(item.name) }))} /></label></details><div className="editor-actions"><Button variant="outline" onClick={() => onSave(event, false)}>{t("Save draft")}</Button><Button onClick={() => onSave(event, true)}>{workflow.approvalStage ? t("Submit for review") : t("Schedule event")}<ArrowRight /></Button></div></div>}
  </DialogContent></Dialog>;
}

function EventDetail({ event, state, onClose, onEdit, onAdvance, onRemove, onDuplicate }: { event: AppEvent | null; state: AppState; onClose: () => void; onEdit: (event: AppEvent) => void; onAdvance: (event: AppEvent) => void; onRemove: (event: AppEvent) => void; onDuplicate: (event: AppEvent) => void }) {
  const { locale, t } = useI18n();
  if (!event) return null;
  const workflow = workflowFor(event, state);
  const index = workflow.stages.indexOf(event.stageId);
  const nextStage = workflow.stages[index + 1];
  const type = state.eventTypes.find((item) => item.name === event.type);
  const activityText = (text: string) => text.startsWith("Moved to ") ? (locale === "ar" ? `انتقلت إلى ${t(text.slice(9))}` : text) : t(text);
  return <Dialog open={!!event} onOpenChange={(value) => !value && onClose()}><DialogContent className="event-detail-dialog"><div className="detail-top"><span className="detail-type" style={{ "--event-color": type?.color || "#677565" } as CSSProperties}>{t(event.type)}</span><span className={`clean-status ${event.status.toLowerCase().replaceAll(" ", "-")}`}>{t(event.status)}</span></div><DialogTitle>{t(event.title)}</DialogTitle><DialogDescription>{event.description ? t(event.description) : t("No description has been added yet.")}</DialogDescription><div className="detail-facts"><span><CalendarDays /><strong>{formatDate(event.date, locale, true)}</strong></span><span><Clock3 /><strong>{event.time}–{event.end}</strong></span><span><MapPin /><strong>{event.location ? t(event.location) : t("Location to confirm")}</strong></span><span><UserRound /><strong>{event.organizer || t("No organizer yet")}</strong></span></div><section className="detail-workflow"><div className="detail-section-title"><span><Workflow />{t("Workflow")}</span><small>{t(workflow.name)}</small></div><StageTrack event={event} state={state} />{nextStage && event.status !== "Cancelled" && <div className="next-action"><span><strong>{locale === "ar" ? `التالي: ${t(nextStage)}` : `Next: ${nextStage}`}</strong><small>{workflow.approvalStage === event.stageId ? (locale === "ar" ? "يمكن للمراجع اعتماد الفعالية أو إعادتها." : "A reviewer can approve or return this event.") : (locale === "ar" ? "تابع عندما تكتمل هذه المرحلة." : "Move ahead when this stage is complete.")}</small></span><Button onClick={() => onAdvance(event)}>{workflow.approvalStage === event.stageId ? t("Approve") : (locale === "ar" ? `الانتقال إلى ${t(nextStage)}` : `Move to ${nextStage}`)}<ArrowRight /></Button></div>}</section><section className="detail-activity"><div className="detail-section-title"><span><CircleDot />{t("Activity")}</span></div><div className="activity-list">{[...event.activity].reverse().map((item) => <div key={item.id}><i /><span><strong>{activityText(item.text)}</strong><small>{new Intl.DateTimeFormat(dateLocale(locale), { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(item.at))}</small></span></div>)}</div></section><div className="detail-actions"><Button variant="ghost" className="danger-action" onClick={() => onRemove(event)}><Trash2 />{t("Delete")}</Button><Button variant="outline" onClick={() => onDuplicate(event)}><Copy />{t("Duplicate")}</Button><Button onClick={() => onEdit(event)}><Pencil />{t("Edit event")}</Button></div></DialogContent></Dialog>;
}

function TypeDialog({ value, workflows, onClose, onSave }: { value: EventTypeConfig | null; workflows: WorkflowConfig[]; onClose: () => void; onSave: (value: EventTypeConfig) => void }) {
  const { locale, t } = useI18n();
  const [draft, setDraft] = useState(value);
  return <Dialog open={!!draft} onOpenChange={(open) => !open && onClose()}><DialogContent className="small-dialog"><DialogTitle>{draft?.name ? t("Edit event type") : t("Add event type")}</DialogTitle><DialogDescription>{t("Choose a clear label, colour, and default workflow.")}</DialogDescription>{draft && <div className="dialog-form"><label>{t("Name")}<Input autoFocus value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label><label>{t("Colour")}<Input className="type-color-input" type="color" value={draft.color} onChange={(event) => setDraft({ ...draft, color: event.target.value })} /></label><label>{t("Default workflow")}<Choice value={draft.workflowId} onChange={(workflowId) => setDraft({ ...draft, workflowId })} label={t("Default workflow")} options={workflows.map((item) => ({ value: item.id, label: t(item.name) }))} /></label><div className="dialog-actions"><Button variant="outline" onClick={onClose}>{t("Cancel")}</Button><Button onClick={() => draft.name.trim() ? onSave({ ...draft, name: draft.name.trim() }) : toast.error(locale === "ar" ? "أضف اسماً لنوع الفعالية." : "Add a name for this event type.")}>{t("Save type")}</Button></div></div>}</DialogContent></Dialog>;
}

function WorkflowDialog({ value, onClose, onSave }: { value: WorkflowConfig | null; onClose: () => void; onSave: (value: WorkflowConfig) => void }) {
  const { locale, t } = useI18n();
  const [draft, setDraft] = useState(value);
  const updateStage = (index: number, stage: string) => { if (!draft) return; const stages = draft.stages.map((item, itemIndex) => itemIndex === index ? stage : item); setDraft({ ...draft, stages, approvalStage: draft.approvalStage === draft.stages[index] ? stage : draft.approvalStage }); };
  return <Dialog open={!!draft} onOpenChange={(open) => !open && onClose()}><DialogContent className="workflow-dialog"><DialogTitle>{draft?.name ? t("Edit workflow") : t("Add workflow")}</DialogTitle><DialogDescription>{t("Keep the route short. Mark one stage as an approval only when needed.")}</DialogDescription>{draft && <div className="dialog-form"><label>{t("Name")}<Input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label><label>{t("Description")}<Textarea value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} /></label><span className="field-heading">{t("Stages")}</span><div className="stage-editor">{draft.stages.map((stage, index) => <div key={index}><Input value={stage} onChange={(event) => updateStage(index, event.target.value)} /><Checkbox checked={draft.approvalStage === stage} onCheckedChange={(checked) => setDraft({ ...draft, approvalStage: checked ? stage : undefined })} /><small>{t("Approval")}</small>{draft.stages.length > 2 && <button onClick={() => setDraft({ ...draft, stages: draft.stages.filter((_, itemIndex) => itemIndex !== index), approvalStage: draft.approvalStage === stage ? undefined : draft.approvalStage })}><Trash2 /></button>}</div>)}</div><button className="add-stage" onClick={() => setDraft({ ...draft, stages: [...draft.stages.slice(0, -1), "New stage", draft.stages.at(-1) || "Completed"] })}><Plus />{t("Add stage")}</button><div className="dialog-actions"><Button variant="outline" onClick={onClose}>{t("Cancel")}</Button><Button onClick={() => draft.name.trim() && draft.stages.every(Boolean) ? onSave({ ...draft, name: draft.name.trim(), stages: [...draft.stages] }) : toast.error(locale === "ar" ? "أضف اسماً لكل مرحلة في سير العمل." : "Name every workflow stage.")}>{t("Save workflow")}</Button></div></div>}</DialogContent></Dialog>;
}

function ExportDialog({ open, onClose, state, year, currentMonth }: { open: boolean; onClose: () => void; state: AppState; year: number; currentMonth: number }) {
  const { locale, t } = useI18n();
  const [format, setFormat] = useState("png");
  const [device, setDevice] = useState("current");
  const [quality, setQuality] = useState("1");
  const [months, setMonths] = useState<number[]>([currentMonth]);
  const [busy, setBusy] = useState(false);
  const [shareReady, setShareReady] = useState<File | null>(null);
  const formats = [
    { id: "png", icon: FileImage, title: "PNG", copy: t("One crisp image") },
    { id: "pdf", icon: FileText, title: "PDF", copy: t("A shareable document") },
    { id: "pptx", icon: Monitor, title: "PowerPoint", copy: t("Slides for presenting") },
    { id: "zip", icon: Layers, title: t("Image bundle"), copy: t("All images in one ZIP") },
  ];
  async function createExport() {
    if (!months.length) { toast.error(locale === "ar" ? "اختر شهراً واحداً على الأقل." : "Select at least one month."); return; }
    setBusy(true); setShareReady(null);
    try {
      const devices: ("desktop" | "phone")[] = format === "pptx" ? ["desktop"] : device === "both" ? ["desktop", "phone"] : [device === "current" ? state.design.device : device as "desktop" | "phone"];
      const items: { art: Artwork; name: string }[] = [];
      for (const selectedMonth of [...months].sort((a, b) => a - b)) for (const selectedDevice of devices) {
        const data = eventsForMonth(state.events, year, selectedMonth, state.eventTypes.map((item) => item.name), "Published");
        const localizedData = data.map((event) => ({ ...event, title: t(event.title), location: t(event.location) }));
        const pages = createArtwork(localizedData, year, selectedMonth, { ...state.design, device: selectedDevice, language: locale });
        pages.forEach((art) => items.push({ art, name: `${MONTHS[selectedMonth]}-${year}-${selectedDevice}${pages.length > 1 ? `-${art.page}` : ""}` }));
      }
      const images: { blob: Blob; name: string; art: Artwork }[] = [];
      for (const item of items) images.push({ ...item, blob: await artworkPng(item.art, Number(quality)) });
      let output: Blob; let filename: string;
      if (format === "pdf") {
        const { jsPDF } = await import("jspdf"); const first = images[0].art;
        const pdf = new jsPDF({ orientation: first.width > first.height ? "landscape" : "portrait", unit: "px", format: [first.width, first.height], compress: true });
        for (let index = 0; index < images.length; index++) { const item = images[index]; if (index) pdf.addPage([item.art.width, item.art.height], item.art.width > item.art.height ? "landscape" : "portrait"); pdf.addImage(new Uint8Array(await item.blob.arrayBuffer()), "PNG", 0, 0, item.art.width, item.art.height, undefined, "FAST"); }
        output = pdf.output("blob"); filename = `Agendati-calendar-${year}.pdf`;
      } else if (format === "pptx") {
        const { default: PptxGenJS } = await import("pptxgenjs"); const deck = new PptxGenJS(); deck.layout = "LAYOUT_WIDE"; deck.title = `Agendati calendar ${year}`; deck.author = "Agendati";
        for (const item of images) { const data = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(item.blob); }); deck.addSlide().addImage({ data, x: 0, y: 0, w: 13.333, h: 7.5 }); }
        output = await deck.write({ outputType: "blob" }) as Blob; filename = `Agendati-calendar-${year}.pptx`;
      } else if (format === "zip" || images.length > 1) {
        const { default: JSZip } = await import("jszip"); const zip = new JSZip(); images.forEach((item) => zip.file(`${item.name}.png`, item.blob)); output = await zip.generateAsync({ type: "blob" }); filename = `Agendati-visuals-${year}.zip`;
      } else { output = images[0].blob; filename = `${images[0].name}.png`; }
      downloadFile(output, filename); setShareReady(new File([output], filename, { type: output.type })); toast.success(locale === "ar" ? "ملف التصدير جاهز." : "Your export is ready.");
    } catch (error) { toast.error(error instanceof Error ? error.message : (locale === "ar" ? "فشل التصدير. حاول مرة أخرى." : "Export failed. Please try again.")); }
    finally { setBusy(false); }
  }
  async function share() { if (!shareReady) return; try { if (navigator.canShare?.({ files: [shareReady] })) await navigator.share({ files: [shareReady], title: "Agendati calendar" }); else { downloadFile(shareReady, shareReady.name); toast(locale === "ar" ? "تم التنزيل — أرفق الملف برسالتك." : "Downloaded — attach the file to your message."); } } catch (error) { if ((error as Error).name !== "AbortError") toast.error(locale === "ar" ? "المشاركة غير متاحة على هذا الجهاز." : "Sharing is not available on this device."); } }
  const deviceOptions = format === "pptx"
    ? [{ value: "desktop", label: locale === "ar" ? "كمبيوتر · شرائح 16:9" : "Desktop · 16:9 slides" }]
    : [{ value: "current", label: state.design.device === "desktop" ? (locale === "ar" ? "الحالي · كمبيوتر 16:9" : "Current · Desktop 16:9") : (locale === "ar" ? "الحالي · هاتف 9:16" : "Current · Phone 9:16") }, { value: "desktop", label: locale === "ar" ? "كمبيوتر · 16:9" : "Desktop · 16:9" }, { value: "phone", label: locale === "ar" ? "هاتف · 9:16" : "Phone · 9:16" }, { value: "both", label: locale === "ar" ? "كمبيوتر + هاتف" : "Desktop + phone" }];
  return <Dialog open={open} onOpenChange={(value) => !busy && !value && onClose()}><DialogContent className="export-dialog"><DialogTitle>{t("Take the month with you.")}</DialogTitle><DialogDescription>{t("Download one month or a set, sized for presentation screens or phones.")}</DialogDescription><div className="export-format-grid">{formats.map(({ id, icon: Icon, title, copy }) => <button key={id} className={format === id ? "active" : ""} onClick={() => setFormat(id)}><Icon /><strong>{title}</strong><small>{copy}</small>{format === id && <CheckCircle2 />}</button>)}</div><div className="form-grid"><label>{t("Device format")}<Choice value={format === "pptx" ? "desktop" : device} onChange={setDevice} label={t("Device format")} options={deviceOptions} /></label><label>{t("Image quality")}<Choice value={quality} onChange={setQuality} label={t("Image quality")} options={[{ value: "1", label: t("Standard · Full HD") }, { value: "2", label: t("High · 2× resolution") }]} /></label></div><span className="field-heading">{locale === "ar" ? `أشهر سنة ${year}` : `Months in ${year}`}</span><div className="export-month-grid">{MONTHS.map((name, index) => <label key={name}><Checkbox checked={months.includes(index)} onCheckedChange={(checked) => setMonths((current) => checked ? [...current, index] : current.filter((item) => item !== index))} /><span>{monthLabel(locale, index).slice(0, 3)}</span></label>)}</div><div className="export-info"><CheckCircle2 /><span>{t("Only published events are included. Busy months automatically continue onto another page.")}</span></div><div className="dialog-actions">{shareReady && <Button variant="outline" onClick={share}><Share2 />{t("Share last export")}</Button>}<Button onClick={createExport} disabled={busy || !months.length}><Download />{busy ? t("Preparing…") : (locale === "ar" ? `تنزيل ${format === "zip" ? "الحزمة" : format.toUpperCase()}` : `Download ${format === "zip" ? "bundle" : format.toUpperCase()}`)}</Button></div></DialogContent></Dialog>;
}
