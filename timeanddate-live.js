import { storage } from 'hatchable';

export const access = 'public';
export const methods = ['GET'];

export default async function(req,res){
  try{
    const file=await storage.get('weather/timeanddate-india-latest.json');
    const data=JSON.parse(new TextDecoder().decode(file.buffer));
    res.setHeader('Cache-Control','no-store');
    res.json(data);
  }catch(e){
    res.status(503).json({source:'Timeanddate India Weather',stateWeather:{},checkedAt:null,error:'Hourly weather snapshot is not available yet. The scheduled collector will populate it on its next run.'});
  }
}