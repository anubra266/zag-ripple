const demos = import.meta.glob('./*.ripple', {
    query: '?raw',
    import: 'default',
    eager: true,
    base: '../components/demos/',
})

export function toPascalCase(str: string): string {
    return str
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join('')
}

export function getComponentCode(id: string) {
    const code = demos[`./${id}.ripple`]
    if (!code) return code

    const pascalCaseId = toPascalCase(id)

    // Use regex to find "export component ComponentName" and replace with pascal case id
    return code.replace(/export component \w+/g, `export component ${pascalCaseId}`)
}