// Public starter furnishings, not an export of an existing user's room state.
export function defaultRoom() {
 const names=['床','书桌','台灯','窗','沙发','冰箱','电视','绿萝','旧相册','日记本','记事本','床头柜','书架','椅子','电脑','茶几','挂画','挂钟','盆栽'];
 return {lamp:false,curtain:true,description:'橡木墙面与白桦木地板的双层小屋，一楼起居，二楼休息。',items:names.map((name,i)=>({id:`starter-${i+1}`,name,state:'已摆放'})),interactions:[]};
}
