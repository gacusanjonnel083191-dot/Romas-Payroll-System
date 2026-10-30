import assert from 'node:assert/strict'
import {test} from 'node:test'
import {
  addressSuggestions, deliveryFeeForDistance, reverseAddress, roadRoute,
} from '../supabase/functions/public-ordering/delivery-routing.mjs'

const origin={latitude:16.051258,longitude:120.341149}
const destination={latitude:16.024662,longitude:120.336088}

test('delivery fee uses started kilometres after the first three',()=>{
  assert.equal(deliveryFeeForDistance(3),80)
  assert.equal(deliveryFeeForDistance(3.001),90)
  assert.equal(deliveryFeeForDistance(4),90)
  assert.equal(deliveryFeeForDistance(4.001),100)
})

test('road route uses dispatch and destination coordinates and provider metres',async()=>{
  let requested
  const route=await roadRoute(origin,destination,'private-key',async(url,options)=>{
    requested={url,options}
    return {ok:true,json:async()=>({routes:[{summary:{distance:4201.4}}]})}
  })
  assert.equal(route.km,4.201)
  assert.equal(route.fee,100)
  assert.equal(requested.url,'https://api.heigit.org/openrouteservice/v2/directions/driving-car/json')
  assert.deepEqual(JSON.parse(requested.options.body).coordinates,[
    [origin.longitude,origin.latitude],[destination.longitude,destination.latitude],
  ])
  assert.equal(requested.options.headers.Authorization,'private-key')
})

test('unroutable delivery fails instead of inventing a fee',async()=>{
  await assert.rejects(roadRoute(origin,destination,'private-key',async()=>({ok:true,json:async()=>({routes:[]})})),
    /No usable driving route/)
})

test('address suggestions are limited to nearby coordinates',async()=>{
  const matches=await addressSuggestions('Malued','private-key',async(url,options)=>{
    assert.equal(url.origin,'https://api.heigit.org')
    assert.equal(url.pathname,'/pelias/v1/autocomplete')
    assert.match(String(url),/boundary.country=PH/)
    assert.equal(options.headers.Authorization,'private-key')
    return {ok:true,json:async()=>({features:[
      {properties:{label:'Malued, Dagupan City'},geometry:{coordinates:[120.335,16.03]}},
      {properties:{label:'Distant place'},geometry:{coordinates:[121,17]}},
    ]})}
  })
  assert.deepEqual(matches,[{label:'Malued, Dagupan City',latitude:16.03,longitude:120.335}])
})

test('map pin can resolve to a nearby address label',async()=>{
  const label=await reverseAddress(16.03,120.335,'private-key',async()=>({ok:true,json:async()=>({features:[{properties:{label:'Malued, Dagupan City'}}]})}))
  assert.equal(label,'Malued, Dagupan City')
})
