const styles = import.meta.glob('./*.css', {
    query: '?raw',
    import: 'default',
    eager: true,
    base: '../styles/',
})


export function getComponentStyles(id: string) {
    const style = styles[`./${id}.css`]
    if (!style) return `[data-scope="${id}"] {\n}\n`
    return style.replace('.accordion ', '[data-scope="accordion"] ')
}