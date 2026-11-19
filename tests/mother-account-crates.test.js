import test from 'node:test'
import assert from 'node:assert/strict'
import {getMotherAccountCratePool,listCrateInventoryPools,summarizeCratesRecordedToday,isRepeatedAccountCrateTrip} from '../src/motherAccountCrates.js'

const resellers = [
  {id:'mangaldan',name:'Mangaldan',reseller_account_id:'shared-1'},
  {id:'mapandan',name:'Mapandan',reseller_account_id:'shared-1'},
  {id:'sanjacinto',name:'San Jacinto',reseller_account_id:'shared-1'},
  {id:'other',name:'Independent',reseller_account_id:null}
]
const accounts=[{id:'shared-1',account_name:'Shared Reseller'}]
const day='2026-11-19'
const events=[
  {id:'a',action:'collection',location_key:'mangaldan',business_date:day,crates:15,covers:4,driver:'Driver 1',reference:'Trip 1',created_at:'2026-11-19T02:01:00Z'},
  {id:'b',action:'collection',location_key:'mapandan',business_date:day,crates:3,covers:2,driver:'Driver 2',reference:'Trip 2',created_at:'2026-11-19T03:02:00Z'},
  {id:'c',action:'dispatch',location_key:'mangaldan',business_date:day,crates:60,covers:30},
  {id:'d',action:'collection',location_key:'mangaldan',business_date:'2026-11-18',crates:99,covers:99},
  {id:'e',action:'collection',location_key:'other',business_date:day,crates:7,covers:1}
]

test('whichever linked outlet is opened shows the same mother-account daily pickups',()=>{
 const a=getMotherAccountCratePool('mangaldan',resellers,accounts)
 const b=getMotherAccountCratePool('mapandan',resellers,accounts)
 assert.equal(a.key,b.key)
 assert.deepEqual(a.outletIds,b.outletIds)
 assert.equal(a.name,'Shared Reseller')
 const total=summarizeCratesRecordedToday(events,a,day)
 assert.equal(total.crates,18)
 assert.equal(total.covers,6)
 assert.deepEqual(total.entries.map(e=>e.outletName),['Mapandan','Mangaldan'])
 assert.deepEqual(summarizeCratesRecordedToday(events,b,day),total)
 assert.equal(summarizeCratesRecordedToday(events,a,'2026-11-20').crates,0)
})

test('standalone resellers are not merged with any mother account',()=>{
 assert.equal(listCrateInventoryPools(resellers,accounts).length,2)
 const single=getMotherAccountCratePool('other',resellers,accounts)
 assert.equal(single.accountId,null)
 assert.equal(summarizeCratesRecordedToday(events,single,day).crates,7)
 assert.equal(getMotherAccountCratePool('unknown',resellers,accounts),null)
})

test('duplicate trip detection is scoped to the same mother-account group',()=>{
 const summary=summarizeCratesRecordedToday(events,getMotherAccountCratePool('mapandan',resellers),day)
 assert.equal(isRepeatedAccountCrateTrip(summary.entries,' driver 1 ','TRIP 1'),true)
 assert.equal(isRepeatedAccountCrateTrip(summary.entries,'Driver 1','Trip 3'),false)
 assert.equal(isRepeatedAccountCrateTrip(summary.entries,'','Trip 1'),false)
})
