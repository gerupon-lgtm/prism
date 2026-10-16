// User selections from audition v2026.10.17-1. Durations exclude the release.
const cue=(id,timbre,releaseSeconds,rows)=>Object.freeze({id,timbre,releaseSeconds,notes:Object.freeze(rows.map(([midi,offsetSeconds,durationSeconds,volume])=>Object.freeze({midi,offsetSeconds,durationSeconds,volume})))});
export const SOUND_CUES=Object.freeze({
  clear:cue('C1','piano',.42,[[69,0,.18,.10],[73,.18,.18,.10],[76,.4,.2,.10],[69,.67,.28,.055],[73,.67,.28,.055],[81,.67,.28,.055]]),
  failure:cue('N2','piano',.42,[[64,0,.18,.11],[60,.25,.18,.10],[57,.52,.25,.10]]),
  tap:cue('T2','wood',.045,[[81,0,.025,.10]]),
  wire:cue('W2','wood',.045,[[81,0,.025,.08],[85,.055,.035,.09]]),
});
