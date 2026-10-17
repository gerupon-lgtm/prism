// User selections from auditions v2026.10.17-1 and -2. Durations exclude release.
const cue=(id,timbre,releaseSeconds,rows)=>Object.freeze({id,timbre,releaseSeconds,notes:Object.freeze(rows.map(([midi,offsetSeconds,durationSeconds,volume,noteTimbre=timbre,noteRelease=releaseSeconds])=>Object.freeze({midi,offsetSeconds,durationSeconds,volume,timbre:noteTimbre,releaseSeconds:noteRelease})))});
export const SOUND_CUES=Object.freeze({
  perfect:cue('F4','brass',.2,[
    [69,0,.075,.12],[73,.12,.075,.12],[76,.24,.09,.12],[81,.42,.14,.12],[85,.66,.08,.11],[83,.8,.08,.11],[81,1,.38,.12],
    [57,0,.12,.035,'strings',.32],[61,0,.12,.035,'strings',.32],[64,0,.12,.035,'strings',.32],
    [59,.42,.13,.035,'strings',.32],[68,.42,.13,.035,'strings',.32],[71,.42,.13,.035,'strings',.32],[76,.42,.13,.035,'strings',.32],
    [57,1,.38,.045,'strings',.32],[69,1,.38,.045,'strings',.32],[73,1,.38,.045,'strings',.32],[76,1,.38,.045,'strings',.32],
  ]),
  clear:cue('C1','piano',.42,[[69,0,.18,.10],[73,.18,.18,.10],[76,.4,.2,.10],[69,.67,.28,.055],[73,.67,.28,.055],[81,.67,.28,.055]]),
  failure:cue('N2','piano',.42,[[64,0,.18,.11],[60,.25,.18,.10],[57,.52,.25,.10]]),
  tap:cue('T2','wood',.045,[[81,0,.025,.10]]),
  wire:cue('W2','wood',.045,[[81,0,.025,.08],[85,.055,.035,.09]]),
  relay:cue('R2','wood',.045,[[85,0,.055,.105]]),
});
