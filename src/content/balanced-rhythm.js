// Balanced practice silhouettes. Authored coordinates remain available to saved/free circuits.
const edge=id=>({id,from:id[0],to:id.slice(1),time:'0.5'});
export const balancedRhythmRevisions={
 Q9:{version:2,positions:{A:{x:.5,y:.26},B:{x:.16,y:.45},E:{x:.84,y:.45},C:{x:.16,y:.70},D:{x:.84,y:.70}},candidates:'SA AB AE BC BD EC ED CG DG BG EG'.split(' ').map(edge)},
 Q10:{version:2,positions:{A:{x:.5,y:.25},B:{x:.14,y:.46},C:{x:.86,y:.46},D:{x:.14,y:.66},E:{x:.86,y:.66},F:{x:.5,y:.78}},candidates:'SA AB AC BD BE CD CE DF EF FG BG CG'.split(' ').map(edge)},
 Q11:{version:2,removeCandidates:['AG'],positions:{A:{x:.5,y:.28},B:{x:.16,y:.51},C:{x:.84,y:.51},D:{x:.5,y:.73}}},
 Q12:{version:2,positions:{A:{x:.5,y:.26},B:{x:.17,y:.45},C:{x:.17,y:.64},D:{x:.83,y:.64},E:{x:.83,y:.45},F:{x:.5,y:.78}},candidates:'SA AB BF AC CF AD ED EF FG AF AE BC DF'.split(' ').map(edge)}
};
