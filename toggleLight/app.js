const app = Vue.createApp({
	data() {
		return {
			n: 5,
			grid: [],
		};
	},
	created() {
		this.generateGrid();
	},
	methods: {
		generateGrid() {
			for (let i = 0; i < this.n; i++) {
				const row = [];
				for (let j = 0; j < this.n; j++) {
					row.push({ x: i, y: j, isLit: false });
				}
				this.grid.push(row);
			}
		},
		handleClick(rowIndex, colIndex) {
			this.grid[rowIndex][colIndex].isLit = !this.grid[rowIndex][colIndex].isLit;
			if (colIndex > 0) {
				this.grid[rowIndex][colIndex - 1].isLit = !this.grid[rowIndex][colIndex - 1].isLit;
			}
			if (colIndex < this.n-1) {
				this.grid[rowIndex][colIndex + 1].isLit = !this.grid[rowIndex][colIndex + 1].isLit;
			}
			if (rowIndex > 0) {
				this.grid[rowIndex - 1][colIndex].isLit = !this.grid[rowIndex - 1][colIndex].isLit;
			}
			if (rowIndex < this.n-1) {
				this.grid[rowIndex + 1][colIndex].isLit = !this.grid[rowIndex + 1][colIndex].isLit;
			}
		},
	},
});

app.mount('#app');