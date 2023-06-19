import url from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import * as google from './google.js';

const FILES = [
	{
		name: 'vcas-calendar.mp4',
		mimeType: 'video/mp4',
		fileId: '1evHK6viimL06nkUw1Zm1V20eHi_dDRob',
	},
	{
		name: 'vcas-calendar.png',
		mimeType: 'image/png',
		fileId: '13Lw95WeX9xzupzKRaKpR_Wr4eYl3cUss',
	},
	{
		name: 'vcas-calendar-part.png',
		mimeType: 'image/png',
		fileId: '1TnNljlH7oroXPuEC5cPjbSozsNiCwdxf',
	},
];

const dirname = path.dirname(url.fileURLToPath(import.meta.url));
const rootPath = path.join(dirname, '../');
const folderPath = path.join(rootPath, 'esperecyan.github.io/');

const auth = google.getAuth();
for (const file of FILES) {
	await google.putFile(auth, file.fileId, file.mimeType, fs.createReadStream(path.join(folderPath, file.name)));
}
