import path from 'node:path';
import {fileURLToPath} from 'node:url';
import globals from 'globals';
import {includeIgnoreFile} from '@eslint/compat';
import esperecyanConfig from '@esperecyan/eslint-config';

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);
const gitignorePath = path.resolve(dirname, '.gitignore');

/** @type {import('eslint').Linter.Config[]} */
export default [
	includeIgnoreFile(gitignorePath, 'Imported .gitignore patterns'),
	...esperecyanConfig,
	{
		languageOptions: {
			globals: {
				...globals.node,
			},
		},
	},
];
