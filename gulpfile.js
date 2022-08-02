const gulp = require('gulp')
const del = require('del')
const es = require('event-stream')
// const sourcemaps = require('gulp-sourcemaps');
const nls = require('vscode-nls-dev')

const languages = [
	{ folderName: 'csy', id: 'cs' }
]

const transifexApiHostname = 'www.transifex.com'
const transifexApiName = 'api'
const transifexApiToken = process.env.TRANSIFEX_API_TOKEN
const transifexProjectName = 'vscode-requirejs'
const transifexExtensionName = 'vscode-requirejs'

const cleanTask = () => del(['out/**', 'package.nls.*.json'])

const createSourceTask = includeNls =>
	gulp.src('src/**/*.js')
		// nls tasks do not support source maps
		// .pipe(sourcemaps.init())
		.pipe(includeNls ? nls.rewriteLocalizeCalls() : es.through())
		.pipe(includeNls ? nls.createAdditionalLanguageFiles(languages, 'i18n', 'out') : es.through())
		// .pipe(sourcemaps.write('../out', {
		// 	includeContent: false,
		// 	sourceRoot: '../src'
		// }))
		.pipe(gulp.dest('out'))

const copyTask = () => createSourceTask(false)

const localizeTask = () => createSourceTask(true)

const compileTask = gulp.series(cleanTask, copyTask)

const packageTask = () =>
	gulp.src('package.nls.json')
		.pipe(nls.createAdditionalLanguageFiles(languages, 'i18n'))
		.pipe(gulp.dest('.'))

const buildTask = gulp.series(cleanTask, localizeTask, packageTask)

gulp.task('clean', cleanTask)

gulp.task('compile', compileTask)

gulp.task('default', buildTask)

gulp.task('transifex-push', () =>
	gulp.src(['**/*.nls.json', '**/*.nls.metadata.json'])
		.pipe(nls.createXlfFiles(transifexProjectName, transifexExtensionName))
		// .pipe(gulp.dest('transifex')))
		.pipe(nls.pushXlfFiles(transifexApiHostname, transifexApiName, transifexApiToken)))

gulp.task('transifex-pull', () =>
	nls.pullXlfFiles(transifexApiHostname, transifexApiName, transifexApiToken,
			languages.map(({ folderName }) => folderName),
			[{ name: transifexExtensionName, project: transifexProjectName }])
		.pipe(gulp.dest('transifex')))

gulp.task('i18n-import', () =>
	gulp.src('transifex/**/*.xlf')
		.pipe(nls.prepareJsonFiles())
		.pipe(gulp.dest('./i18n')))
