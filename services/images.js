const CDN = 'https://imagecache.365scores.com/image/upload';

const transforms = {
  athlete: 'f_png,w_200,h_200,c_limit,q_auto:eco,dpr_1,d_Athletes:{id}.png,r_max,c_thumb,g_face,z_0.65',
  team: 'f_png,w_96,h_96,c_limit,q_auto:eco,dpr_1,d_Competitors:default1.png',
  countryFlag: 'f_auto,q_auto',
};

const folders = {
  athlete: 'Athletes/NationalTeam',
  team: 'Competitors',
  countryFlag: 'Countries',
};

function getAthletePhotoUrl(athleteId) {
  if (!athleteId) return null;
  return `${CDN}/${transforms.athlete}/v26/${folders.athlete}/${athleteId}`;
}

function getCountryFlagUrl(countryId) {
  if (!countryId) return null;
  return `${CDN}/${transforms.countryFlag}/${folders.countryFlag}/${countryId}.png`;
}

function getTeamBadgeUrl(competitorId, imageVersion = 1) {
  if (!competitorId) return null;
  return `${CDN}/${transforms.team}/v${imageVersion}/${folders.team}/${competitorId}`;
}

module.exports = { getAthletePhotoUrl, getCountryFlagUrl, getTeamBadgeUrl };
