/**
 * mogojo/services-subscription-gate
 *
 * Enforces ARCH10: every exported async mutating service function must call
 * `checkSubscriptionGate(actor, action, db)` as its first executable statement.
 *
 * Mutation detection is verb-driven, not receiver-driven — catches
 * `prisma.x.update`, `tx.x.update`, `db.x.update`, `scopedClient(actor).x.update`,
 * and any aliased Prisma client.
 *
 * Escape hatch: `@gateExempt <reason>` in the leading comment block of the
 * function declaration. Bare `@gateExempt` (no reason) is an error.
 *
 * The rule does NOT validate the value of the `action` argument — only call shape.
 */

const MUTATION_VERBS = new Set([
  'create',
  'createMany',
  'update',
  'updateMany',
  'delete',
  'deleteMany',
  'upsert',
]);

const GATE_CALLEE = 'checkSubscriptionGate';
const GATE_EXEMPT_TAG = /@gateExempt(?:\s+(\S.*))?/;

/**
 * @param {string|undefined} filename
 * @returns {boolean}
 */
function fileIsInScope(filename) {
  if (!filename) return false;
  if (/[\\/](__tests__|fixtures)[\\/]/.test(filename)) return false;
  if (/\.test\.[mc]?[jt]sx?$/.test(filename)) return false;
  return (
    /[\\/]apps[\\/]web[\\/]lib[\\/]services[\\/].+\.[mc]?[jt]sx?$/.test(filename) ||
    /[\\/]apps[\\/]api[\\/]src[\\/]services[\\/].+\.[mc]?[jt]sx?$/.test(filename)
  );
}

/**
 * Walk every node under `root` and invoke `visit` once per node.
 *
 * @param {object} root
 * @param {(node: object) => void} visit
 */
function walk(root, visit) {
  if (!root || typeof root !== 'object') return;
  const stack = [root];
  while (stack.length) {
    const node = stack.pop();
    if (!node || typeof node !== 'object') continue;
    if (typeof node.type === 'string') visit(node);
    for (const key of Object.keys(node)) {
      if (key === 'parent' || key === 'loc' || key === 'range') continue;
      const child = node[key];
      if (Array.isArray(child)) {
        for (const item of child) {
          if (item && typeof item === 'object') stack.push(item);
        }
      } else if (child && typeof child === 'object') {
        stack.push(child);
      }
    }
  }
}

/**
 * True iff `node` is a CallExpression of the form `X.Y.<verb>(...)`
 * where `<verb>` is a Prisma mutation verb.
 */
function isPrismaMutationCall(node) {
  if (!node || node.type !== 'CallExpression') return false;
  const callee = node.callee;
  if (!callee || callee.type !== 'MemberExpression' || callee.computed) return false;
  const verb = callee.property && callee.property.name;
  if (!MUTATION_VERBS.has(verb)) return false;
  // Require the receiver to itself be a MemberExpression or CallExpression,
  // ensuring at least two levels of property access (e.g. `prisma.x.update`,
  // `scopedClient(actor).x.update`). A bare `x.update(...)` does not match.
  const receiver = callee.object;
  if (!receiver) return false;
  return (
    receiver.type === 'MemberExpression' ||
    receiver.type === 'CallExpression' ||
    receiver.type === 'ChainExpression'
  );
}

function functionContainsMutation(fnNode) {
  let found = false;
  walk(fnNode.body, (node) => {
    if (found) return;
    if (isPrismaMutationCall(node)) found = true;
  });
  return found;
}

/**
 * True iff `stmt` is `const { a, b } = paramName` (parameter destructuring) —
 * we skip these when looking for the first executable statement.
 */
function isParameterDestructuring(stmt, paramNames) {
  if (!stmt || stmt.type !== 'VariableDeclaration') return false;
  return stmt.declarations.every((decl) => {
    if (!decl.init) return true;
    if (decl.init.type === 'Identifier' && paramNames.has(decl.init.name)) return true;
    if (decl.init.type === 'MemberExpression') {
      let cursor = decl.init;
      while (cursor.type === 'MemberExpression') cursor = cursor.object;
      return cursor.type === 'Identifier' && paramNames.has(cursor.name);
    }
    return false;
  });
}

/**
 * Returns the callee Identifier if `expr` is `checkSubscriptionGate(...)`
 * or `await checkSubscriptionGate(...)`.
 */
function getGateCallee(expr) {
  if (!expr) return null;
  let inner = expr;
  if (inner.type === 'AwaitExpression') inner = inner.argument;
  if (!inner || inner.type !== 'CallExpression') return null;
  if (inner.callee && inner.callee.type === 'Identifier' && inner.callee.name === GATE_CALLEE) {
    return inner.callee;
  }
  return null;
}

function collectParamNames(fnNode) {
  const names = new Set();
  for (const param of fnNode.params ?? []) {
    if (param.type === 'Identifier') names.add(param.name);
  }
  return names;
}

/**
 * Find the comment text immediately preceding the given declaration node,
 * walking outward through `ExportNamedDeclaration` / `VariableDeclaration`
 * wrappers.
 */
function getLeadingComments(sourceCode, node) {
  let target = node;
  while (target.parent && (
    target.parent.type === 'ExportNamedDeclaration' ||
    target.parent.type === 'ExportDefaultDeclaration' ||
    target.parent.type === 'VariableDeclaration' ||
    target.parent.type === 'VariableDeclarator'
  )) {
    target = target.parent;
  }
  return sourceCode.getCommentsBefore(target) ?? [];
}

/**
 * Inspect leading comments for `@gateExempt`. Returns:
 *   { exempt: true, reason: string }  — valid exemption
 *   { exempt: false, bareTag: true }  — `@gateExempt` with empty/missing reason
 *   { exempt: false }                  — no tag
 */
function readGateExempt(comments) {
  for (const comment of comments) {
    const match = GATE_EXEMPT_TAG.exec(comment.value);
    if (!match) continue;
    const reason = (match[1] ?? '').trim();
    if (reason.length === 0) return { exempt: false, bareTag: true };
    return { exempt: true, reason };
  }
  return { exempt: false };
}

const rule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Enforce that every exported async mutating service function calls checkSubscriptionGate as its first statement (Story 10.1).',
    },
    schema: [],
    messages: {
      missingGate:
        "Mutating service function '{{name}}' must call checkSubscriptionGate(actor, action, db) as its first statement (Story 10.1).",
      bareGateExempt: '@gateExempt requires a non-empty reason.',
    },
  },

  create(context) {
    const filename = context.filename ?? context.getFilename();
    if (!fileIsInScope(filename)) return {};

    const sourceCode = context.sourceCode ?? context.getSourceCode();

    function isInsideExport(node) {
      let parent = node.parent;
      // Skip VariableDeclarator + VariableDeclaration wrappers.
      while (parent && (parent.type === 'VariableDeclarator' || parent.type === 'VariableDeclaration')) {
        parent = parent.parent;
      }
      return parent && (
        parent.type === 'ExportNamedDeclaration' ||
        parent.type === 'ExportDefaultDeclaration'
      );
    }

    function nodeName(node) {
      if (node.id && node.id.name) return node.id.name;
      const parent = node.parent;
      if (parent && parent.type === 'VariableDeclarator' && parent.id.type === 'Identifier') {
        return parent.id.name;
      }
      return '<anonymous>';
    }

    function reportIfBad(fnNode) {
      if (!fnNode.async) return;
      if (!isInsideExport(fnNode)) return;
      if (!fnNode.body || fnNode.body.type !== 'BlockStatement') return;

      const comments = getLeadingComments(sourceCode, fnNode);
      const exempt = readGateExempt(comments);
      if (exempt.bareTag) {
        context.report({ node: fnNode, messageId: 'bareGateExempt' });
        return;
      }
      if (exempt.exempt) return;

      if (!functionContainsMutation(fnNode)) return;

      const params = collectParamNames(fnNode);
      let firstStmt = null;
      for (const stmt of fnNode.body.body) {
        if (isParameterDestructuring(stmt, params)) continue;
        firstStmt = stmt;
        break;
      }

      if (
        firstStmt &&
        firstStmt.type === 'ExpressionStatement' &&
        getGateCallee(firstStmt.expression)
      ) {
        return; // ok
      }

      context.report({
        node: fnNode,
        messageId: 'missingGate',
        data: { name: nodeName(fnNode) },
      });
    }

    return {
      FunctionDeclaration: reportIfBad,
      ArrowFunctionExpression: reportIfBad,
      FunctionExpression: reportIfBad,
    };
  },
};

export default rule;
