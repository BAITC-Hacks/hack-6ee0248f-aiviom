# Career Quest · working atlas

The interface is an operational atlas of a person's development: current position, required assignments, one next action, and evidence of what has been confirmed. The mode is **Operate**. Navigation is stable across roles, while rights and available actions remain server controlled.

## Composition decision

Compared on the employee “My path” surface before implementation:

| Composition          | Desktop                                                                                                               | Phone                                                                             | Decision                                                                                                          |
| -------------------- | --------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| A · metric dashboard | Four equal cards above a feed                                                                                         | Stack of metric cards before any action                                           | Rejected: metrics delay the assignment and recommendation.                                                        |
| B · working atlas    | Compact identity/goal strip; required work and 1–3 recommendations in the main column; route and settings beside them | Identity/goal, required work, recommendations, route, then settings in one column | **Chosen:** keeps the next valid action visible and shows the distinction between planned and confirmed progress. |
| C · full route map   | Large route visual before tasks                                                                                       | Tall route before controls                                                        | Rejected: impressive at a glance, costly when a task needs action.                                                |

## Tokens

| Token             | Value                            | Use                                                 |
| ----------------- | -------------------------------- | --------------------------------------------------- |
| Canvas            | `#F6F5F1`                        | App background                                      |
| Surface           | `#FFFFFF`                        | Panels and dialogs                                  |
| Secondary surface | `#EFEEE8`                        | Subtle group backgrounds                            |
| Ink               | `#20252D`                        | Primary text                                        |
| Secondary ink     | `#59616D`                        | Supporting text                                     |
| Primary           | `#2846C7`                        | Actions, selected navigation, projected outlines    |
| Radius            | `8px` controls; `12px` panels    | Structured, quiet geometry                          |
| Spacing           | `4, 8, 12, 16, 24, 32, 48, 64px` | Page rhythm                                         |
| Type              | Locally hosted Noto Sans 400–700 | RU, KK, EN; body 16px, tables 14px, supporting 12px |

Desktop uses a 240px sidebar and content up to 1440px with 32px insets. From 768 to 1023px it uses a menu and 24px insets. Phones use one column, 16px insets, and up to three primary destinations plus “More”. All controls target at least 44×44px. Analytical tables scroll inside their own container on narrow screens.

The CQ monogram joins an open C and forward Q tail. It is supplied as full color, monochrome, inverse, and wordmark SVG. The mark uses crisp strokes at 16/24/32px. It has no photograph or illustration because the product's data and decision record carry the content.

Projected effects use outlined marks and explicit “Preview” language. Confirmed milestones use filled marks and explicit “Confirmed” language. Green, amber, and red status hues always accompany text. The same pattern holds in reduced motion.

Motion is a 120–180ms control transition and 180–240ms overlay transition; reduced motion removes movement. No main content waits for an entrance animation.

## Review context

Pinned atlas direction supersedes prior green identity. The code preserves React/Vite, Express, SQLite, formulas, role rights, and recorded source data. This document defines the visual world; release verification and language coverage are recorded separately.
