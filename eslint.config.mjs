import nextConfig from 'eslint-config-next'

const config = [{ ignores: ['.next/**', 'node_modules/**', '.agents/**'] }, ...nextConfig]

export default config
