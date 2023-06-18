import url from 'node:url';
import path from 'node:path';
import fs from 'node:fs/promises';
import assert from 'node:assert';
import canvas from '@napi-rs/canvas';
import * as core from '@actions/core';
import * as google from './google.js';
import * as calendar from './calendar.js';

const POSTER_WIDTH = 1130;
const POSTER_HEIGHT = 1600;

const dirname = path.dirname(url.fileURLToPath(import.meta.url));
const rootPath = path.join(dirname, '../');
const pagesFolderPath = path.join(rootPath, '_site/');
const cacheDataFolderPath = path.join(rootPath, 'cache/');
const cachePicturePath = path.join(cacheDataFolderPath, 'picture');
const cacheTextPath = path.join(cacheDataFolderPath, 'text.json');

let cachePicture;
try {
	cachePicture = await fs.readFile(cachePicturePath);
} catch (exception) {
	// ファイルが存在しない場合
}
let cacheText;
try {
	cacheText = JSON.parse(await fs.readFile(cacheTextPath, { encoding: 'utf-8' }));
} catch (exception) {
	// ファイルが存在しない場合
}

const auth = google.getAuth();
const picture = await google.fetchPicture(auth, cachePicture);
const dateTitlesPairs = await calendar.fetchWeeklyEventDateTitlesPairs(auth);

let updated = !cachePicture || !cacheText || !!picture.stream;
if (!updated) {
	// キャッシュが存在し、絵柄の更新がなければ
	try {
		assert.deepStrictEqual(Array.from(dateTitlesPairs), cacheText);
	} catch (exception) {
		// 日時・イベント名の更新があれば
		updated = true;
	}
}

if (updated) {
	canvas.GlobalFonts
		.registerFromPath(path.join(dirname, '../rounded-mplus/rounded-mplus-1p-heavy.ttf'), 'Rounded M+');
	canvas.GlobalFonts.registerFromPath(path.join(dirname, '../noto-emoji/fonts/NotoColorEmoji.ttf'), 'Noto Emoji');
	const FONT_FAMILY = '"Rounded M+", "Noto Emoji"';

	const baseImage = await canvas.loadImage(path.join(dirname, './template-base.png'));

	const c = canvas.createCanvas(baseImage.naturalWidth, baseImage.naturalHeight);
	const context = c.getContext('2d');

	context.drawImage(baseImage, 0, 0);

	try {
		await fs.mkdir(cacheDataFolderPath);
	} catch (exception) {
		// すでにフォルダが存在する場合
	}

	////////////////////////////////////////////////////////////////////////////////
	// 絵柄
	////////////////////////////////////////////////////////////////////////////////

	const PICTURE_X = 46;
	const PICTURE_Y = 40;
	const PICTURE_WIDTH = c.width - PICTURE_X * 2;
	const PICTURE_HEIGHT = PICTURE_WIDTH / 16 * 9;
	const PICTURE_LICENSE_FONT_SIZE = 32;
	const PICTURE_LICENSE_PADDING = 5;

	if (picture.stream) {
		await fs.writeFile(cachePicturePath, picture.stream);
	}

	context.drawImage(
		await canvas.loadImage(picture.stream ? cachePicturePath : cachePicture),
		PICTURE_X,
		PICTURE_Y,
		PICTURE_WIDTH,
		PICTURE_HEIGHT,
	);

	const pictureLicenseCanvas = canvas.createCanvas(PICTURE_WIDTH, PICTURE_LICENSE_FONT_SIZE);
	const pictureLicenseContext = pictureLicenseCanvas.getContext('2d');
	pictureLicenseContext.font = PICTURE_LICENSE_FONT_SIZE + 'px ' + FONT_FAMILY;
	pictureLicenseContext.fillStyle = '#000000';
	pictureLicenseContext.textBaseline = 'top';
	pictureLicenseContext.fillText('© ' + google.FILENAME_PATTERN.exec(picture.name)[1], 0, 0);
	// 文字列幅の検出
	let pictureLicenseWidth;
	pictureLicenseWidth:
	for (let x = pictureLicenseCanvas.width - 1; x >= 0; x--) {
		const data = pictureLicenseContext.getImageData(x, 0, 1, pictureLicenseCanvas.height).data;
		for (let i = 3; i < data.length; i += 4) {
			if (data[i] === 0) {
				// 透明なら
				continue;
			}

			pictureLicenseWidth = x + 1 + PICTURE_LICENSE_PADDING * 2;
			break pictureLicenseWidth;
		}
	}
	const pictureLicenseHeight = pictureLicenseCanvas.height + PICTURE_LICENSE_PADDING * 2;
	const pictureLicenseX = PICTURE_X + PICTURE_WIDTH - pictureLicenseWidth;
	const pictureLicenseY = PICTURE_Y + PICTURE_HEIGHT - pictureLicenseHeight;
	context.fillStyle = '#FFFFFF72';
	context.fillRect(pictureLicenseX, pictureLicenseY, pictureLicenseWidth, pictureLicenseHeight);
	context.drawImage(
		pictureLicenseCanvas,
		pictureLicenseX + PICTURE_LICENSE_PADDING,
		pictureLicenseY + PICTURE_LICENSE_PADDING,
	);

	////////////////////////////////////////////////////////////////////////////////
	// 日時・イベント名
	////////////////////////////////////////////////////////////////////////////////

	await fs.writeFile(cacheTextPath, JSON.stringify(Array.from(dateTitlesPairs), null, '\t'));

	const PADDING_TOP = 13;
	const LINE_SPACE = 11;
	const PADDING_BOTTOM = 20;
	const DATE_X = 51;
	const TITLE_X = 419;
	const FONT_SIZE = 50;
	const BORDER_SIZE = 19;

	let y = 1156;

	context.font = FONT_SIZE + 'px ' + FONT_FAMILY;
	context.textBaseline = 'top';

	for (const [ date, titles ] of dateTitlesPairs) {
		y += PADDING_TOP;
		context.fillStyle = '#FFFFFF';
		context.fillText(date, DATE_X, y);

		if (titles.length < 2) {
			titles.push(...new Array(2 - titles.length));
		}
		context.fillStyle = '#000000';
		for (const [ i, title ] of titles.entries()) {
			if (i !== 0) {
				y += LINE_SPACE;
			}
			context.fillText(title, TITLE_X, y);
			y += FONT_SIZE;
		}

		y += PADDING_BOTTOM;

		context.fillStyle = '#00DBFB';
		context.fillRect(0, y, c.width, BORDER_SIZE);
		y += BORDER_SIZE;
	}

	context.drawImage(await canvas.loadImage(path.join(dirname, './template-top.png')), 0, 0);

	////////////////////////////////////////////////////////////////////////////////
	// 出力
	////////////////////////////////////////////////////////////////////////////////

	try {
		await fs.mkdir(pagesFolderPath);
	} catch (exception) {
		// ローカルデバッグで、すでにフォルダが存在する場合
	}

	const outputCanvas = canvas.createCanvas(POSTER_WIDTH, POSTER_HEIGHT);
	outputCanvas.getContext('2d').drawImage(c, 0, 0, outputCanvas.width, outputCanvas.height);
	await fs.writeFile(path.join(pagesFolderPath, 'v4.png'), outputCanvas.toBuffer('image/png'));
}

core.setOutput('updated', updated);
