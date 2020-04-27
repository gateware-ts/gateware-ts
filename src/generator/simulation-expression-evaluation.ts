/**
 * @internal
 * @packageDocumentation
 */
import { SubmodulePathT } from '../signals';
import { SUBMODULE_PATH_EXPRESSION } from '../constants';
import { SignalLikeOrValue, UnsliceableExpressionMap } from '../main-types';
import { GWModule } from "../gw-module"
import { ExpressionEvaluator } from './expression-evaluation';

export class SimulationExpressionEvaluator extends ExpressionEvaluator {
  constructor(m:GWModule, uem:UnsliceableExpressionMap) {
    super(m, uem);
  }

  evaluate(expr:SignalLikeOrValue) {
    if (typeof expr === 'number') {
      return expr.toString();
    }

    if (expr.type === SUBMODULE_PATH_EXPRESSION) {
      return this.evaluateSubmodulePath(expr as SubmodulePathT);
    }

    return super.evaluate(expr);
  }

  evaluateSubmodulePath(e:SubmodulePathT) {
    return e.path;
  }
};
