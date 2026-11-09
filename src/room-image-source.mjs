// Only immutable files served by this plugin's loopback image handler are allowed.
export function isRoomImageUrl(value,formats=['png','webp','svg+xml','jpeg']){
 if(typeof value!=='string'||value.length>12*1024*1024)return false;
 const data=value.match(/^data:image\/(png|webp|svg\+xml|jpeg);base64,[A-Za-z0-9+/=]+$/);
 if(data)return formats.includes(data[1]);
 const app=value.match(/^dsh-app:\/\/app\/plugins\/dsh-whale-status\/assets\/[a-f0-9]{64}\/[A-Za-z0-9_-]+\.(png|webp|svg|jpg)$/);
 if(app)return formats.includes(({svg:'svg+xml',jpg:'jpeg'})[app[1]]||app[1]);
 const local=value.match(/^http:\/\/127\.0\.0\.1:(\d{1,5})\/plugins\/dsh-whale-status\/assets\/[a-f0-9]{64}\/[A-Za-z0-9_-]+\.(png|webp|svg|jpg)$/);
 return Boolean(local&&Number(local[1])>0&&Number(local[1])<=65535&&formats.includes(({svg:'svg+xml',jpg:'jpeg'})[local[2]]||local[2]));
}
