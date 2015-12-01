import Random from 'random-seed'
import Patch from '../src/patch'
import {traverse, traversalDistance, format as formatPoint} from '../src/point-helpers'
import TestDocument from './helpers/test-document'
import './helpers/add-to-html-methods'

describe('Patch', function () {
  it('correctly records basic non-overlapping splices', function () {
    let seed = 123
    let patch = new Patch(seed)
    patch.spliceWithText({row: 0, column: 3}, {row: 0, column: 4}, 'hello')
    patch.spliceWithText({row: 0, column: 10}, {row: 0, column: 5}, 'world')
    assert.deepEqual(patch.getChanges(), [
      {start: {row: 0, column: 3}, replacedExtent: {row: 0, column: 4}, replacementText: 'hello'},
      {start: {row: 0, column: 10}, replacedExtent: {row: 0, column: 5}, replacementText: 'world'}
    ])
  })

  it('correctly records basic overlapping splices', function () {
    let seed = 123
    let patch = new Patch(seed)
    patch.spliceWithText({row: 0, column: 3}, {row: 0, column: 4}, 'hello world')
    patch.spliceWithText({row: 0, column: 9}, {row: 0, column: 7}, 'sun')
    assert.deepEqual(patch.getChanges(), [
      {start: {row: 0, column: 3}, replacedExtent: {row: 0, column: 6}, replacementText: 'hello sun'},
    ])
  })

  it.only('correctly records random splices', function () {
    this.timeout(Infinity)

    for (let i = 0; i < 100000; i++) {
      let seed = Date.now()
      let random = new Random(seed)
      let input = new TestDocument(seed)
      let output = input.clone()
      let patch = new Patch(seed)

      for (let j = 0; j < 30; j++) {
        if (random(10) < 2) { // 20% splice input
          let {start: inputStart, replacedExtent, replacementExtent, replacementText} = input.performRandomSplice()
          let outputStart = patch.translateInputPosition(inputStart)
          let outputReplacedExtent = traversalDistance(
            patch.translateInputPosition(traverse(inputStart, replacedExtent)),
            outputStart
          )
          output.splice(outputStart, outputReplacedExtent, replacementText)
          patch.spliceInput(inputStart, replacedExtent, replacementExtent)
        } else { // 80% normal splice
          let {start, replacedExtent, replacementExtent, replacementText} = output.performRandomSplice()
          patch.spliceWithText(start, replacedExtent, replacementText)
        }
        verifyPatch(patch, input.clone(), output, seed)
      }
    }

    function verifyPatch (patch, input, output, seed, random) {
      let seedMessage = `Random seed: ${seed}`

      verifyInputPositionTranslation(patch, input, output, seedMessage, random)
      verifyOutputPositionTranslation(patch, input, output, seedMessage, random)
      for (let {start, replacedExtent, replacementText} of patch.getChanges()) {
        input.splice(start, replacedExtent, replacementText)
      }
      assert.equal(input.getText(), output.getText(), seedMessage)
    }

    function verifyInputPositionTranslation (patch, input, output, seedMessage) {
      let row = 0
      for (let line of input.getLines()) {
        let column = 0
        for (let character of line) {
          let inputPosition = {row, column}
          if (!patch.isChangedAtInputPosition(inputPosition)) {
            let outputPosition = patch.translateInputPosition(inputPosition)
            assert.equal(output.characterAtPosition(outputPosition), character, seedMessage)
          }
          column++
        }
        row++
      }
    }

    function verifyOutputPositionTranslation (patch, input, output, seedMessage) {
      let row = 0
      for (let line of output.getLines()) {
        let column = 0
        for (let character of line) {
          let outputPosition = {row, column}
          if (!patch.isChangedAtOutputPosition(outputPosition)) {
            let inputPosition = patch.translateOutputPosition(outputPosition)
            assert.equal(input.characterAtPosition(inputPosition), character, seedMessage)
          }
          column++
        }
        row++
      }
    }
  })
})