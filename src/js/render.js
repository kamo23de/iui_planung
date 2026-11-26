// Neuzeichnen der aktiven Ansicht
import {S} from './state.js';
import {runChecks} from './checks.js';
import {renderCapacity} from './views/capacity.js';
import {renderCheck} from './views/check.js';
import {renderDetail} from './views/detail.js';
import {renderForecast} from './views/forecast.js';
import {renderOverview} from './views/overview.js';
import {renderRatio} from './views/ratio.js';
import {renderSemester} from './views/semester.js';
import {renderPlan} from './plan/view.js';

export function renderAll() {
  runChecks();
  renderCheck();
  const t = S.tab;
  if (t === 'overview') renderOverview();
  if (t === 'semester') renderSemester();
  if (t === 'forecast') renderForecast();
  if (t === 'ratio') renderRatio();
  if (t === 'detail') renderDetail();
  if (t === 'cap') renderCapacity();
  if (t === 'plan') renderPlan();
}
