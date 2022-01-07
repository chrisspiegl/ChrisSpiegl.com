const path = require('path');
const util = require('util');
const glob = require('glob');
const sharp = require('sharp');
const mkdirp = require('mkdirp');

const outputPath = '_site/assets/images/';

const resizeConf = {
	sizes: [
		{
			width: 320,
			rename: {suffix: '-320w'},
		},
		{
			width: 640,
			rename: {suffix: '-640w'},
		},
		{
			width: 1280,
			rename: {suffix: '-1280w'},
		},
		{
			width: 1920,
			rename: {suffix: '-1920w'},
		},
		{
			width: 3840,
			rename: {suffix: '-3840w'},
		},
	],
	jpegOptions: {
		quality: 80,
		progressive: true,
		withMetadata: true,
		force: false,
		//   ErrorOnUnusedImage: false,
		//   errorOnEnlargement: false
	},
	webpOptions: {
		quality: 80,
		withMetadata: true,
		force: true,
	},
	pngOptions: {
		compressionLevel: 8,
		force: false,
	},
};

module.exports = class {
	async data() {
		const filePath = path.join(__dirname, '/images/');
		return {
			permalink: '/assets/images/images.json',
			eleventyExcludeFromCollections: true,
			filePath,
		};
	}

	async loadImages(imgFolder) {
		const cwd = path.resolve(imgFolder.file);
		const getImages = util.promisify(glob);
		const processedImages = [];

		const imgs = await getImages('**/*(*.jpg|*.png|*.gif)', {cwd});
		const imgsRendered = await getImages('**/*(*.jpg|*.png|*.gif)', {cwd: outputPath});

		for (const img of imgs) {
			const ext = path.extname(img);
			const base = path.basename(img, ext);
			const dir = path.dirname(img);

			mkdirp.sync(path.join(outputPath, dir));

			if (!imgsRendered.includes(img)) {
				// Console.log(`PASS THROUGH MASTER FOR ${img}`)
				const passThroughImg = sharp(imgFolder.file + img);
				passThroughImg.toFile(path.join(outputPath, dir, base + ext));
			} else {
				// Console.log(`FOUND MASTER FOR ${img}`)
			}

			const image = sharp(imgFolder.file + img);
			image
				.jpeg(resizeConf.jpegOptions)
				.png(resizeConf.pngOptions)
				.webp(resizeConf.webpOptions);
			for (const size of resizeConf.sizes) {
				const newPath = path.join(dir, base + size.rename.suffix + ext);
				const newPathOutput = path.join(outputPath, newPath);
				if (imgsRendered.includes(newPath)) {
					// Console.log(`FOUND RESIZED IMAGE FOR ${newPath}`)
					continue;
				}

				// Console.log(`RENDERING NEW RESIZED IMAGE FOR ${newPath}`)
				const resized = image.resize({
					width: size.width,
					withoutEnlargement: true,
					kernel: 'lanczos2',
				});
				resized.toFile(newPathOutput);
			}

			processedImages.push(img);
		}

		return JSON.stringify(processedImages, null, '\t');
	}

	async render({filePath}) {
		try {
			return await this.loadImages({file: filePath});
		} catch (error) {
			throw new Error(error);
		}
	}
};
