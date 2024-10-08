/**
 * SGF parsing module
 * @module parse-sgf
 */

/**
 * @private
 * @param {string} sgf SGF string to parse
 * @returns {{
 * tokenType: (
 * '('|')'|';'|'propValue'|'propIdent');
 * value?: string;
 * depth?: number;
 * }[]} array of token objects
 */
async function tokenize(sgf) {
    let tokens = [];

    let inPropIdent = false;
    let propIdContent = '';

    let bracketPos;
    let inBrackets = false;
    let escaped = false;
    let bracketContents = '';

    for (let i = 0; i < sgf.length; i++) {

        // handle square bracket contents (property value)
        if (inBrackets && escaped) {
            escaped = false;
            bracketContents += sgf[i];
        } else if (inBrackets && sgf[i] === '\\') {
            escaped = true;
        } else if (inBrackets && sgf[i] === ']') {
            inBrackets = false;
            console.log(bracketContents.slice(0));
            tokens.push({
                tokenType: 'propValue',
                value: bracketContents.slice(0)
            })
            bracketContents = '';
        } else if (inBrackets && i < sgf.length - 1) {
            bracketContents += sgf[i];
        } else if (inBrackets) {
            throw new Error(
                `missing ']' after [ at ${bracketPos}`
            )
        } else if (sgf[i] === '[') {
            bracketPos = i;
            inBrackets = true;

        // handle property identifier
        } else if (/[A-Z]/.test(sgf[i])) {
            propIdContent += sgf[i];
            inPropIdent = true;
            if (!/[A-Z]/.test(sgf[i+1])) {
                if (sgf[i+1] === '[') {
                    inPropIdent = false;
                }
                tokens.push({
                    tokenType: 'propIdent',
                    value: propIdContent.slice(0)
                })
                propIdContent = '';
            }
        } else if (inPropIdent) {
            throw new Error(
                `expecting propVal after propIdent '${
                    tokens[tokens.length-1].value
                }'`
            )

        // non-bracket terminal symbols
        } else if ('();'.includes(sgf[i])) {
            tokens.push({
                tokenType: sgf[i]
            })
        } else {
            console.log(`'${sgf[i]}' not valid SGF char`);
        }
    }
    return tokens;
}

/**
 * @private
 * @param {Array} tokens Array of tokens to search
 * @returns {number} Position of next post-node token
 */
function endNode(tokens) {
    for (let i = 1; i < tokens.length; i++) {
        if ('();'.includes(tokens[i].tokenType)) {
            return i;
        }
    }
    return -1;
}

/**
 * @private
 * @param {Array} propTokens Array of a node's prop tokens
 * @returns {{}} Object containing a node's properties
 */
function handleProps(propTokens) {
    let properties = {}
    let entries = [];
    for (let prop of propTokens) {
        if (prop.tokenType === 'propIdent') {
            entries.push([prop.value]);
        } else {
            entries[entries.length-1].push(prop.value);
        }
    }
    for (let pair of entries) {
        let values = pair.slice(1);
        if (values.length === 1) {
            values = values[0];
        }
        properties[pair[0]] = values;
    }
    return properties;
}

/**
 * @private
 * @param {Array} tokens Tokenized SGF
 * @returns {Array} Condensed token list
 */
async function parseTokens(tokens) {
    let squishedTokens = [];
    for (let i=0; i<tokens.length;i++) {
        let token = tokens[i]
        switch (token.tokenType) {

            case '(':
                squishedTokens.push(token);
                break;

            case ')':
                squishedTokens.push(token);
                break;

            case ';':
                let j = endNode(tokens.slice(i)) + i;
                let props = tokens.slice(i, j);
                token.props = handleProps(props.slice(1));
                squishedTokens.push(token);
                break;
        }
        console.log(token);
    }
    return squishedTokens;
}

/**
 * @private
 * @param {Array} toks Slice of toks starting w/ '('
 * @returns {number} Position of matching ')' token
 */
function getTreeEnd(toks) {
    let j = -1;
    for (let i = 1; i < toks.length; i++) {
        let token = toks[i];
        if (token.tokenType === '(') {
            j++;
        } else if (token.tokenType === ')' && j < 0) {
            return i;
        } else if (token.tokenType === ')') {
            j--;
        }
    }
    return -1;
}

/**
 * @private
 * @param {Array} toks Tokens of type '(', ')', ';'
 * @returns {{}} Node tree of all moves and variations
 */
async function makeTree(toks) {
    if (toks[0]) {

        switch (toks[0].tokenType) {
            case '(':
                let trees = [];
                while (toks.length) {
                    let treeEnd = getTreeEnd(toks);
                    let subTree = toks.slice(1,treeEnd);
                    let subNode = await makeTree(subTree);
                    trees.push(subNode);
                    toks = toks.slice(treeEnd+1);
                }
                console.log(trees);
                return trees;
    
            case ';':
                let node= {}
                if (toks[0].hasOwnProperty('props')) {
                    node.props = toks[0].props;
                }
                if (toks.length > 1) {
                    let childs;
                    childs = await makeTree(toks.slice(1));
                    if (Array.isArray(childs)) {
                        node.children = childs;
                    } else {
                        node.children = [childs];
                    }
                }
                return node;
        }
    } else {
        throw new Error(
            `'tokens[0]' in makeTree is ${toks[0]}`
        )
    }
}

/**
 * @param {string} sgf SGF string
 * @returns {{
 * props?: {};
 * children?: {}[]
 * }} Game node tree
 */
async function ParseSGF(sgf) {
    let tree = tokenize(sgf)
    .then((result) => parseTokens(result))
    .then((result) => makeTree(result));
    return tree;
}

export default ParseSGF;