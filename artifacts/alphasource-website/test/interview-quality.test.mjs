import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeScoringSummary, qualityAnalysisForDisplay } from '../src/lib/interviewQuality.mjs';
const scores = {response_specificity:80,answer_directness:80,answer_consistency:80,communication_structure:80};
const input = {version:'role_quality_v3',role_answers:70,answer_quality:80,overall:72,weights:{role_answers:80,answer_quality:20},answer_quality_scores:scores,scorable_questions:2};
test('formula components are validated and safe fields projected',()=>{
 const safe=normalizeScoringSummary({...input,private_rubric:'secret'});
 assert.equal(safe.overall,72); assert.equal(safe.private_rubric,undefined);
 assert.equal(normalizeScoringSummary({...input,overall:80}),null);
 assert.equal(normalizeScoringSummary({...input,answer_quality_scores:{}}),null);
});
test('stale analysis evidence is hidden; authoritative four values stay visible',()=>{
 const safe=normalizeScoringSummary(input);
 assert.deepEqual(qualityAnalysisForDisplay({version:'path_a_v1',evidence:['stale'],scores:{response_specificity:1}},safe),{scores});
 assert.equal(qualityAnalysisForDisplay({version:'path_a_v1_role_quality_v3',evidence:['current']},safe).evidence[0],'current');
 const legacy={version:'path_a_v1'}; assert.equal(qualityAnalysisForDisplay(legacy,null),legacy);
});

test('no-score v3 cannot display legacy independently generated quality scores',()=>{ assert.equal(qualityAnalysisForDisplay({scores:{response_specificity:90}},null,'role_quality_v3'),null); });
