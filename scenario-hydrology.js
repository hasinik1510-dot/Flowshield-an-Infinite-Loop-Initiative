export const access = "public";

const PIB = {
  "Andhra Pradesh":[26.34,25.02,7.88],"Arunachal Pradesh":[3.69,3.29,0.01],"Assam":[26.36,20.29,2.93],"Bihar":[34.51,31.32,14.47],"Chhattisgarh":[14.30,13.07,6.30],"Goa":[0.38,0.31,0.07],"Gujarat":[27.58,25.61,14.33],"Haryana":[10.27,9.30,12.72],"Himachal Pradesh":[1.12,1.01,0.39],"Jharkhand":[6.15,5.63,1.85],"Karnataka":[19.27,17.41,11.58],"Kerala":[5.45,4.93,2.46],"Madhya Pradesh":[36.07,34.15,20.26],"Maharashtra":[33.89,31.99,16.57],"Manipur":[0.44,0.40,0.04],"Meghalaya":[1.84,1.54,0.08],"Mizoram":[0.21,0.19,0.01],"Nagaland":[0.55,0.50,0.02],"Odisha":[17.44,16.02,7.81],"Punjab":[18.60,16.80,26.27],"Rajasthan":[12.87,11.62,17.10],"Sikkim":[0.24,0.22,0.01],"Tamil Nadu":[22.61,20.46,15.04],"Telangana":[21.93,19.84,9.26],"Tripura":[1.53,1.24,0.12],"Uttar Pradesh":[73.39,66.97,46.89],"Uttarakhand":[2.13,1.95,1.05],"West Bengal":[25.85,23.50,10.62],"Delhi":[0.38,0.35,0.32],"Jammu & Kashmir":[2.30,2.07,0.51]
};

const BASIN = {
  "Andhra Pradesh":["Godavari / Krishna",129.17+86.32],"Arunachal Pradesh":["Brahmaputra",592.32],"Assam":["Brahmaputra / Barak",592.32+93.65],"Bihar":["Ganga",581.75],"Chhattisgarh":["Mahanadi / Godavari",72.82+129.17],"Goa":["West-flowing coastal",116.47],"Gujarat":["Narmada / Tapi / Sabarmati",49.95+20.98+9.87],"Haryana":["Indus / Ganga plain",47.3+581.75],"Himachal Pradesh":["Indus / Himalayan",47.3],"Jharkhand":["Subernarekha / Ganga",14.48+581.75],"Karnataka":["Krishna / Cauvery",86.32+26.53],"Kerala":["West-flowing coastal",116.47],"Madhya Pradesh":["Narmada / Ganga / Godavari",49.95+581.75+129.17],"Maharashtra":["Godavari / Krishna",129.17+86.32],"Manipur":["Barak / Myanmar drainage",93.65+31.86],"Meghalaya":["Brahmaputra / Barak",592.32+93.65],"Mizoram":["Barak / Myanmar drainage",93.65+31.86],"Nagaland":["Brahmaputra / Myanmar drainage",592.32+31.86],"Odisha":["Mahanadi / Brahmani-Baitarani",72.82+31.27],"Punjab":["Indus / Ganga plain",47.3+581.75],"Rajasthan":["Luni / inland drainage",26.95],"Sikkim":["Ganga / Himalayan",581.75],"Tamil Nadu":["Cauvery / east-flowing",26.53+27.06],"Telangana":["Godavari / Krishna",129.17+86.32],"Tripura":["Barak / east-flowing",93.65],"Uttar Pradesh":["Ganga / Yamuna",581.75],"Uttarakhand":["Ganga / Himalayan",581.75],"West Bengal":["Ganga / Brahmaputra",581.75+592.32],"Delhi":["Yamuna / Ganga",581.75],"Jammu & Kashmir":["Indus",47.3]
};

const DENSITY = {
  "Andhra Pradesh":0.65,"Arunachal Pradesh":0.92,"Assam":0.95,"Bihar":0.88,"Chhattisgarh":0.70,"Goa":0.84,"Gujarat":0.44,"Haryana":0.62,"Himachal Pradesh":0.80,"Jharkhand":0.72,"Karnataka":0.49,"Kerala":0.90,"Madhya Pradesh":0.61,"Maharashtra":0.57,"Manipur":0.78,"Meghalaya":0.98,"Mizoram":0.88,"Nagaland":0.83,"Odisha":0.86,"Punjab":0.70,"Rajasthan":0.28,"Sikkim":0.82,"Tamil Nadu":0.58,"Telangana":0.50,"Tripura":0.82,"Uttar Pradesh":0.76,"Uttarakhand":0.86,"West Bengal":0.92,"Delhi":0.55,"Jammu & Kashmir":0.42
};

function gwClass(extraction, extractable){
  const pct=extractable>0?extraction/extractable*100:0;
  return pct>=100?'over-extraction':pct>=70?'high-extraction':pct>=50?'moderate-extraction':'lower-extraction';
}

export default async function(req,res){
  const q=req.query||{};
  const states=Object.entries(PIB).map(([state,v])=>{const [recharge,extractable,extraction]=v;const basin=BASIN[state]||['regional drainage',0];return {state,rechargeBCM:recharge,extractableBCM:extractable,extractionBCM:extraction,extractionPct:extractable?+(extraction/extractable*100).toFixed(2):0,groundwaterClass:gwClass(extraction,extractable),basin:basin[0],basinAvailabilityBCM:basin[1],drainageDensity:DENSITY[state]??0.5};});
  const selected=states.find(x=>x.state===q.state)||null;
  res.json({updated:'2026-09-09',icedSource:'https://iced.niti.gov.in/climate-and-environment/water/ground-water-levels',icedYears:['2024-25','2023-24','2022-23'],groundwaterBasis:'ICED/CGWB groundwater-level context; current state resource/extraction figures from the 2025 CGWB assessment reproduced by PIB.',pibSource:'https://www.pib.gov.in/PressReleasePage.aspx?PRID=2223850&reg=3&lang=1',drainageDensitySource:'https://www.researchgate.net/publication/335137330_An_Integrated_Approach_in_Developing_Flood_Vulnerability_Index_of_India_using_Spatial_Multi-Criteria_Evaluation_Technique',drainageSystemsSource:'https://www.pmfias.com/classification-of-drainage-systems-of-india/',selected,states});
}