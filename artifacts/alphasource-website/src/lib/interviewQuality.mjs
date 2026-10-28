const keys = ['response_specificity','answer_directness','answer_consistency','communication_structure'];
export function normalizeScoringSummary(value) {
  if (!value || value.version !== 'role_quality_v3' || value.weights?.role_answers !== 80 || value.weights?.answer_quality !== 20) return null;
  const numeric = n => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 100;
  const quality = Object.fromEntries(keys.map(k => [k, value.answer_quality_scores?.[k]]));
  const count = value.scorable_questions;
  if (!Object.values(quality).every(n => numeric(n) && Number.isInteger(n)) || !numeric(value.role_answers) || !numeric(value.answer_quality) || !numeric(value.overall) || !Number.isInteger(count) || count < 1 || count > 25) return null;
  const roleTotal = Math.round(value.role_answers * count), qualityTotal = Object.values(quality).reduce((a,b) => a+b,0);
  if (Math.abs(value.role_answers-roleTotal/count)>1e-8 || value.answer_quality!==qualityTotal/4 || value.overall!==Math.round((roleTotal*80*4+qualityTotal*20*count)/(100*count*4))) return null;
  return { version: 'role_quality_v3', role_answers: value.role_answers, answer_quality: value.answer_quality, overall: value.overall, answer_quality_scores: quality };
}
export function qualityAnalysisForDisplay(value, summary, version) {
  if (!summary) return version === 'role_quality_v3' ? null : value;
  const current = value?.version === 'path_a_v1_role_quality_v3' ? value : {};
  return { ...current, scores: { ...summary.answer_quality_scores } };
}
