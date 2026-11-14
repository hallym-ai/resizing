import assert from 'node:assert/strict';
import {textContentBoxWidth} from './pptx-native-elements.mjs';

assert.equal(textContentBoxWidth({width:'552.484px',boxSizing:'border-box',paddingLeft:'0px',paddingRight:'0px',borderLeftWidth:'0px',borderRightWidth:'0px'},552),552.484,'fractional width retains the original CSS text box');
assert.equal(textContentBoxWidth({width:'100.75px',boxSizing:'border-box',paddingLeft:'3.25px',paddingRight:'2px',borderLeftWidth:'1px',borderRightWidth:'0.5px'},99),94,'border box excludes padding and borders');
assert.equal(textContentBoxWidth({width:'100.75px',boxSizing:'content-box',paddingLeft:'3.25px',paddingRight:'2px',borderLeftWidth:'1px',borderRightWidth:'0.5px'},106),100.75,'content box width already excludes padding and borders');
assert.equal(textContentBoxWidth({width:'auto',paddingLeft:'3px',paddingRight:'2px'},105),100,'unknown computed width uses client-width fallback');
assert.equal(textContentBoxWidth({width:'0px',boxSizing:'content-box'},0),1,'invalid or empty width is bounded');
const measuredSingleLine=552.1817488281249;assert.ok(measuredSingleLine>552&&measuredSingleLine<=textContentBoxWidth({width:'552.484px',boxSizing:'border-box'},552),'a fitting line is not broken by integer rounding');
console.log('pass: fractional PPTX text boxes, border/content sizing, padding and safe fallback');
