---
name: Career Quest
description: A working atlas for evidence-based career development
colors:
  canvas: "#F6F5F1"
  surface: "#FFFFFF"
  soft: "#EFEEE8"
  ink: "#20252D"
  muted: "#59616D"
  line: "#DADCE0"
  accent: "#2846C7"
  accent-soft: "#E8ECFC"
  success: "#176742"
  success-soft: "#E7F4EC"
  warning: "#865B13"
  warning-soft: "#FFF1D8"
  danger: "#A83439"
  danger-soft: "#FCE9E8"
typography:
  headline:
    fontFamily: "Noto Sans, Arial, sans-serif"
    fontSize: "32px"
    fontWeight: 700
    lineHeight: 1.16
    letterSpacing: "-0.03em"
  title:
    fontFamily: "Noto Sans, Arial, sans-serif"
    fontSize: "22px"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "-0.02em"
  body:
    fontFamily: "Noto Sans, Arial, sans-serif"
    fontSize: "16px"
    fontWeight: 400
  table:
    fontFamily: "Noto Sans, Arial, sans-serif"
    fontSize: "14px"
  caption:
    fontFamily: "Noto Sans, Arial, sans-serif"
    fontSize: "12px"
rounded:
  control: "8px"
  panel: "12px"
  pill: "999px"
spacing:
  "1": "4px"
  "2": "8px"
  "3": "12px"
  "4": "16px"
  "6": "24px"
  "8": "32px"
  "12": "48px"
  "16": "64px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.surface}"
    rounded: "{rounded.control}"
    padding: "10px 16px"
    height: "44px"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.accent}"
    rounded: "{rounded.control}"
    padding: "10px 16px"
    height: "44px"
  panel:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.panel}"
    padding: "24px"
---

# Design System: Career Quest

## Overview

**Creative North Star: "The Working Atlas"**

The interface is an operational atlas of a person's development: current position, required assignments, one next action, and evidence of what has been confirmed. Its light working surfaces remain consistent across the five roles. Rights and available actions remain server controlled.

**Key Characteristics:**

- A warm canvas and flat white working surfaces.
- Ultramarine for actions, selected navigation, focus, and preview outlines.
- Status color always accompanied by readable text.
- No decorative image where tasks and data carry the content.

### My path composition decision

Compared on the employee “My path” surface before implementation:

| Composition          | Desktop                                                                                                               | Phone                                                                             | Decision                                                                                                          |
| -------------------- | --------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| A · metric dashboard | Four equal cards above a feed                                                                                         | Stack of metric cards before any action                                           | Rejected: metrics delay the assignment and recommendation.                                                        |
| B · working atlas    | Compact identity/goal strip; required work and 1–3 recommendations in the main column; route and settings beside them | Identity/goal, required work, recommendations, route, then settings in one column | **Chosen:** keeps the next valid action visible and shows the distinction between planned and confirmed progress. |
| C · full route map   | Large route visual before tasks                                                                                       | Tall route before controls                                                        | Rejected: impressive at a glance, costly when a task needs action.                                                |

## Colors

The frontmatter records the exact palette used in `src/client/styles.css`. Ultramarine is reserved for interaction and projected effects; warm canvas, white, soft stone, ink, muted ink, and fine lines organize content. Green, amber, and red are semantic states paired with pale backgrounds.

**The Status-in-Words Rule.** Status color must accompany a readable state label; color alone never conveys approval, warning, or error.

## Typography

Locally hosted Noto Sans, with Arial and sans-serif fallback, supports Russian, Kazakh, and English. The UI declares weights 400–700; the font file and OFL license ship in `public/fonts/`. Metrics use tabular numerals.

The page heading is bold at 32px on desktop and 28px on phones. Section headings are bold at 22px and 20px respectively. Body copy begins at 16px, table and button text at 14px, and compact support copy at 12px.

**The Data-First Type Rule.** Headings separate working sections; support copy explains a number rather than competing with it.

## Layout

Desktop at 1024px and above has a 240px sidebar, content up to 1440px, and 32px horizontal insets. From 768px to 1023px, the sidebar becomes a menu and the insets become 24px. At 767px and below, the layout uses one column, 16px insets, and bottom navigation with three primary destinations plus More. At 390px and below, the narrow header keeps the CQ mark and drops its text. Safe-area padding protects bottom navigation.

Spacing follows a 4, 8, 12, 16, 24, 32, 48, 64px rhythm. Main controls have at least 44px interactive height. Analytical tables scroll inside their own container and show a scroll cue on phones.

## Elevation & Depth

Working panels are flat, separated by tonal contrast and fine borders. Dialogs use a deep shadow and dimmed backdrop; fixed mobile navigation has a subtler upward shadow.

**The Flat Working Surface Rule.** Routine panels stay flat; elevation identifies overlays and fixed navigation only.

## Shapes

Controls have 8px corners; panels and dialogs have 12px corners. Only compact status tags use a pill silhouette. The original SVG CQ monogram joins an open C with a forward Q tail; color, monochrome, inverse, wordmark, and favicon versions ship in `public/brand/`.

## Components

### Buttons and fields

Primary buttons are ultramarine with white text. Secondary buttons are white with a blue border and text. Buttons keep a 44px minimum height during loading. Fields and selects have white backgrounds, fine borders, and 8px corners. Keyboard focus uses a 3px ultramarine outline with offset. Hover transitions are 160ms where hover exists; reduced-motion preferences remove them. The current dialog has no entrance animation.

All selection controls use the same bordered trigger and white popup. Long activity and skill lists add an in-popup search field; selected options carry a check and readable label. The popup supports arrows, Home, End, Enter, Escape, and outside-click dismissal.

### Panels and tags

White panels have a fine border, 12px corners, and 24px padding that tightens to 18px on phones. Neutral and semantic tags include a short text label.

### Navigation and progress

Active navigation uses an ultramarine tint and text. Preview uses outlined or dashed marks and an explicit preview label. Confirmed milestones use filled marks and confirmation language. Goal coverage, plan completion, and personal credits remain separate metrics.

The employee route presents server-ordered activity steps between the current profile and target requirements. Each step shows status, effort, session, projected skill change, and activities it unlocks; blocked steps keep their reason in a disclosure. Practical projects appear beside the skill step they can advance. The four factual recommendation grounds remain visible before the deeper explanation. Confirmed completion receipts use server-calculated before and after values and never borrow preview values.

## Do's and Don'ts

### Do:

- **Do** keep the next valid action near its facts and status.
- **Do** label preview and confirmed states explicitly.
- **Do** keep analytical tables locally scrollable on narrow screens.

### Don't:

- **Don't** replace working data with decorative illustrations.
- **Don't** use semantic color without text.
- **Don't** style ordinary panels as elevated overlays.
