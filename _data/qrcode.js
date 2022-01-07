const QRCode = require('qrcode');
const mkdirp = require('mkdirp');

module.exports = async () => {
	const coins = {
		btc: {
			name: 'Bitcoin',
			addr: 'bc1qcnjmuyr3a0ysejqnzwtu0dylsyt3w7hggwa49x',
			link: 'bitcoin:bc1qcnjmuyr3a0ysejqnzwtu0dylsyt3w7hggwa49x?label=Donation&message=Thank%20You%21',
		},
		ltc: {
			name: 'Litecoin',
			addr: 'ltc1q2d3gqjn9y5evh0uvfesgqnqxwguwky78448aw7',
			link: 'litecoin:ltc1q2d3gqjn9y5evh0uvfesgqnqxwguwky78448aw7?label=Donation&message=Thank%20You%21',
		},
		doge: {
			name: 'Dogecoin',
			addr: 'DRZVXSnWM9BEL9FFLdE2qmUDBpbWLQC4Cp',
			link: 'DRZVXSnWM9BEL9FFLdE2qmUDBpbWLQC4Cp?label=Donation&message=Thank%20You%21',
		},
		xlm: {
			name: 'Stellar Lumens',
			addr: 'GADRZ6G2BXHUJGJQUNR4L6KK3RUPLT3AIV2CP6JQ37ICODJP4FMW7T5T',
			link: 'GADRZ6G2BXHUJGJQUNR4L6KK3RUPLT3AIV2CP6JQ37ICODJP4FMW7T5T?label=Donation&message=Thank%20You%21',
		},
		bat: {
			name: 'Basic Attention Token',
			addr: '0x5696005CA7F60F86F69bdBd897987c410D34398F',
			link: '0x5696005CA7F60F86F69bdBd897987c410D34398F?label=Donation&message=Thank%20You%21',
		},
	};

	for (const coin of Object.keys(coins)) {
		const exportPath = '_site';
		const folderPath = '/assets/images/qrcodes';
		mkdirp.sync(exportPath + folderPath);
		coins[coin].filepath = `${folderPath}/${coin}-${coins[coin].addr}.svg`;
		await QRCode.toFile(`${exportPath}${coins[coin].filepath}`, coins[coin].link);
		coins[coin].rendered = `!!! ${coins[coin].name} — $${coin.toUpperCase()}: \`${coins[coin].addr}\`
![QR Code for $${coin.toUpperCase()} address](${coins[coin].filepath})
!!!`;
	}

	return coins;
};
