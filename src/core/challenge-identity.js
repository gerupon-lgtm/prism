export const RANDOM_CHALLENGE_REVISION=1;
const baseId=challenge=>`${challenge.id}@${challenge.version}`;
const randomPrefix=challenge=>`${baseId(challenge)}/random-${RANDOM_CHALLENGE_REVISION}-`;

export function challengeScoreId(challenge){
  return challenge.draw?randomPrefix(challenge)+challenge.draw.id:baseId(challenge);
}
export function matchesChallengeScore(score,challenge){
  return score.rule===`${challenge.type}@1`&&(score.challenge===baseId(challenge)||score.challenge.startsWith(randomPrefix(challenge)));
}
