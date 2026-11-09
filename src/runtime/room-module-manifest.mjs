export function validateRoomModuleManifest(records) {
  const result=Object.create(null);
  for(const record of records){
    if(!/^[a-z][a-z-]*$/.test(record.id)||!/^client\.room-ui-[a-z-]+-v52\.js$/.test(record.chunk)||!/^[a-f0-9]{64}$/.test(record.revision)||Object.hasOwn(result,record.id))throw Error('Invalid room module manifest: '+record.id);
    result[record.id]=Object.freeze({...record,dependencies:Object.freeze([...(record.dependencies||[])])});
  }
  return Object.freeze(result);
}
