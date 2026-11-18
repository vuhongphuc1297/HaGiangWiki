import assert from 'node:assert/strict';
import test from 'node:test';
import { amountInput, formattedAmount, positiveAmount } from '../src/features/expenses/expense.form.ts';

test('VND input preserves exact dong through formatting including values beyond Number precision', () => {
  for (const value of ['1', '101001', '9007199254740993', '9223372036854775807']) {
    const display = formattedAmount(value);
    assert.equal(amountInput(display), value);
    assert.equal(positiveAmount(amountInput(display)), value);
  }
  assert.equal(formattedAmount('600000'), '600.000');
  assert.equal(amountInput('000600000'), '600000');
});

test('invalid monetary input never silently becomes a positive expense', () => {
  for (const value of ['', '0', '-1', '+1', '1e3', 'NaN', '100 đ', 'abc', '9223372036854775808']) {
    assert.equal(positiveAmount(amountInput(value)), null, value);
  }
});

test('clearing or correcting a draft amount keeps it editable after validation errors', () => {
  assert.equal(formattedAmount(amountInput('')), '');
  assert.equal(positiveAmount('0'), null);
  assert.equal(positiveAmount(amountInput('100.000')), '100000');
  assert.equal(formattedAmount(amountInput('101.001')), '101.001');
});
