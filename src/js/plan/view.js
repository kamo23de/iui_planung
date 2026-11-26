// Planung: Reiter
import {$} from '../util.js';
import {renderGoals} from './goals.js';
import {PLAN} from './scenario.js';
import {renderTimeline} from './timeline.js';

export let PL_SUB = 'tl';   // Unteransicht: tl = Zeitstrahl, goal = Zielwerte
export const setPlSub = v => { PL_SUB = v; };
export function renderPlan() {
  $('#plName').value = PLAN.name;
  $('#plCount').textContent = PLAN.items.length ? `${PLAN.items.length} Planmaßnahme${PLAN.items.length === 1 ? '' : 'n'}` : 'noch keine Planmaßnahmen';
  $('#plTl').classList.toggle('hidden', PL_SUB !== 'tl'); $('#plGoal').classList.toggle('hidden', PL_SUB !== 'goal');
  if (PL_SUB === 'tl') renderTimeline(); else renderGoals();
}
