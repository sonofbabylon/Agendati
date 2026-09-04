import { seedEvents, type CalendarEvent, type Design, DEFAULT_DESIGN } from "./calendar-data";

export type ActivityItem = {
  id: string;
  at: string;
  text: string;
};

export type AppEvent = CalendarEvent & {
  workflowId: string;
  stageId: string;
  description: string;
  audience: string;
  organizer: string;
  capacity?: number;
  activity: ActivityItem[];
};

export type EventTypeConfig = {
  id: string;
  name: string;
  color: string;
  workflowId: string;
};

export type WorkflowConfig = {
  id: string;
  name: string;
  description: string;
  stages: string[];
  approvalStage?: string;
};

export type AppSettings = {
  name: string;
  weekStart: "Monday" | "Sunday";
  workingDays: number[];
  workStart: string;
  workEnd: string;
  timeZone: string;
};

export type AppState = {
  events: AppEvent[];
  eventTypes: EventTypeConfig[];
  workflows: WorkflowConfig[];
  settings: AppSettings;
  design: Design;
};

export const DEFAULT_WORKFLOWS: WorkflowConfig[] = [
  {
    id: "simple",
    name: "Simple schedule",
    description: "For everyday events that do not need approval.",
    stages: ["Draft", "Scheduled", "Completed"],
  },
  {
    id: "review",
    name: "Review before publishing",
    description: "For workshops and training that need a quick review.",
    stages: ["Draft", "Review", "Approved", "Registration open", "Completed"],
    approvalStage: "Review",
  },
  {
    id: "ceremony",
    name: "Approval and preparation",
    description: "For higher-visibility events with preparation work.",
    stages: ["Draft", "Management approval", "Preparation", "Published", "Completed"],
    approvalStage: "Management approval",
  },
];

export const DEFAULT_EVENT_TYPES: EventTypeConfig[] = [
  { id: "workshop", name: "Workshop", color: "#47785f", workflowId: "review" },
  { id: "training", name: "Training", color: "#4e7d9d", workflowId: "review" },
  { id: "ceremony", name: "Ceremony", color: "#9c7341", workflowId: "ceremony" },
  { id: "internal-meeting", name: "Internal meeting", color: "#797469", workflowId: "simple" },
  { id: "committee-meeting", name: "Committee meeting", color: "#84618c", workflowId: "simple" },
  { id: "event", name: "Event", color: "#a9654c", workflowId: "simple" },
];

const workflowForType = (type: string) => {
  if (type === "Workshop" || type === "Training") return "review";
  if (type === "Ceremony") return "ceremony";
  return "simple";
};

const seeded = seedEvents().map<AppEvent>((event, index) => {
  const workflowId = workflowForType(event.type);
  const workflow = DEFAULT_WORKFLOWS.find((item) => item.id === workflowId)!;
  const stageId = index % 6 === 0 && workflow.approvalStage ? workflow.approvalStage : workflowId === "simple" ? "Scheduled" : "Approved";
  const status = stageId === "Draft" ? "Draft" : stageId === workflow.approvalStage ? "In review" : "Published";
  return {
    ...event,
    status,
    workflowId,
    stageId,
    description: event.description || "A sample event ready to customize.",
    audience: "All team members",
    organizer: index % 2 ? "Maya Chen" : "Alex Morgan",
    capacity: event.type === "Workshop" || event.type === "Training" ? 30 : undefined,
    activity: [
      { id: `activity-${event.id}`, at: "2026-08-28T09:00:00Z", text: "Event created" },
      ...(stageId !== "Draft" ? [{ id: `activity-stage-${event.id}`, at: "2026-08-29T11:30:00Z", text: `Moved to ${stageId}` }] : []),
    ],
  };
});

export const DEFAULT_APP_STATE: AppState = {
  events: seeded,
  eventTypes: DEFAULT_EVENT_TYPES,
  workflows: DEFAULT_WORKFLOWS,
  settings: {
    name: "Agendati calendar",
    weekStart: "Monday",
    workingDays: [1, 2, 3, 4, 5],
    workStart: "09:00",
    workEnd: "17:00",
    timeZone: "Local time",
  },
  design: { ...DEFAULT_DESIGN, brand: "AGENDATI" },
};

export const uid = () => typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

export const addActivity = (event: AppEvent, text: string): AppEvent => ({
  ...event,
  activity: [...event.activity, { id: uid(), at: new Date().toISOString(), text }],
});

export function normalizeState(value: Partial<AppState> | null | undefined): AppState {
  if (!value) return DEFAULT_APP_STATE;
  return {
    events: Array.isArray(value.events) ? value.events : DEFAULT_APP_STATE.events,
    eventTypes: Array.isArray(value.eventTypes) ? value.eventTypes : DEFAULT_APP_STATE.eventTypes,
    workflows: Array.isArray(value.workflows) ? value.workflows : DEFAULT_APP_STATE.workflows,
    settings: { ...DEFAULT_APP_STATE.settings, ...value.settings },
    design: { ...DEFAULT_APP_STATE.design, ...value.design },
  };
}
