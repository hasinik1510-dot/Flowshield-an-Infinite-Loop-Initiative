export const access='public';
export const methods=['GET'];

const cities=['Mumbai','Bengaluru','Chennai','Hyderabad','Kolkata','Ahmedabad','Pune','Delhi'];

export default async function(req,res){
  try{
    const [mainResp,climateResp]=await Promise.all([
      fetch('https://mausam.imd.gov.in/index_en.php',{headers:{'User-Agent':'Mozilla/5.0'}}),
      fetch('https://mausam.imd.gov.in/imd_latest/contents/climate_services_daily_temeprature_maps.php',{headers:{'User-Agent':'Mozilla/5.0'}})
    ]);
    const html=await mainResp.text();
    const climateOk=climateResp.ok;
    const out={};
    for(const city of cities){
      const i=html.indexOf('### '+city);
      const windowText=i>=0?html.slice(i,i+900):'';
      const m=windowText.match(/(\d+(?:\.\d+)?)\s*%/);
      if(m)out[city]=+m[1];
    }
    res.setHeader('Cache-Control','no-store');
    res.json({humidity:out,source:'India Meteorological Department current weather',climateServicesPage:climateOk,checkedAt:new Date().toISOString()});
  }catch(e){res.status(503).json({humidity:{},source:'India Meteorological Department',climateServicesPage:false,checkedAt:null});}
}