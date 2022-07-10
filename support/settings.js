const { readFileSync } = require('fs')
const { join } = require('path')

const pkg = join(__dirname, '../package.json')
const { properties } = JSON.parse(readFileSync(pkg, 'utf8')).contributes.configuration

console.log(`| Name | Type | Default | Description |
| ---- | ---- | ------- | ----------- |`)
for (const key in properties) {
  const { type, default: value, description } = properties[key]
  console.log(`| ${key.slice(21)} | \`${type}\` | \`${value}\` | ${description} |`)
}
