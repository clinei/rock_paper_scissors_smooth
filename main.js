let canvas_width = 128;
let canvas_height = canvas_width;

let win_amount = 0.1;
let lose_amount = -0.1;
let other_amount = -0.0;
let idle_amount = 0.3;
let noise_amount = 0.02;
// gotta press Space to turn on the noise

let neighbor_weights = [
                        0.5, 0.5, 0.5,
                        0.5, 1.0, 0.5,
                        0.5, 0.5, 0.5,
                       ];
let self_weights =     [
                        0.2, 0.2, 0.2,
                        0.2, 1.0, 0.2,
                        0.2, 0.2, 0.2,
                       ];

let sys = {
	curr_time: 0,
	noise_active: false,
	buffers: [[], []],
	curr_buffer: [],
	next_buffer: [],
};

let canvas;
let ctx;
let pixels;

function main() {
	canvas = document.getElementById("canvas");
	ctx = canvas.getContext("2d", {willReadFrequently: true});
	register_events();
	window_resize();
	sys.start_time = Date.now();
	sys.curr_time = sys.start_time;
	init_slots();
	init_sources();
	render();
}
function register_events() {
	window.addEventListener("resize", window_resize);
	window.addEventListener("keydown", window_keydown);
	window.addEventListener("mousedown", window_mousedown);
	window.addEventListener("mouseup", window_mouseup);
	window.addEventListener("mousemove", window_mousemove);
}
function window_keydown(event) {
	if (event.code == "Space") {
		sys.noise_active = sys.noise_active == false;
	}
}
function window_mousedown(event) {
	if (event.buttons & 1) {
		sys.mouse_held = true;
	}
}
function window_mouseup(event) {
	sys.mouse_held = false;
}
function window_mousemove(event) {
	sys.mouse_x = event.clientX;
	sys.mouse_y = event.clientY;
}
function window_resize(event) {
	resize_canvas();
}
function resize_canvas() {
	canvas.width = canvas_width;
	canvas.height = canvas_height;
}
function update_input() {
	if (sys.mouse_held) {
		let canvas_rect = canvas.getBoundingClientRect();
		if (canvas_rect.left <= sys.mouse_x && sys.mouse_x < canvas_rect.right &&
		    canvas_rect.top <= sys.mouse_y && sys.mouse_y < canvas_rect.bottom) {
			let canvas_x = sys.mouse_x - canvas_rect.left;
			let canvas_y = sys.mouse_y - canvas_rect.top;
		    let viewport_width = canvas_rect.right - canvas_rect.left;
		    let viewport_height = canvas_rect.bottom - canvas_rect.top;
		    let grid_x = Math.floor(canvas_x / (viewport_width / canvas.width));
		    let grid_y = Math.floor(canvas_y / (viewport_height / canvas.height));
		    add_center(sys.curr_buffer, grid_x, grid_y);
		    add_center(sys.next_buffer, grid_x, grid_y);
		}
	}
}
function render() {
	sys.curr_time = Date.now();

	ctx.clearColor = "rgba(0,0,0,0)";
	ctx.clearRect(0,0, canvas.width, canvas.height);

	update_input();

	swap_buffers();
	calculate_next_frame();

	pixels = ctx.getImageData(0,0, canvas.width, canvas.height);

	for (let i = 0; i < sys.curr_buffer.slots.length; i += sys.curr_buffer.choice_count) {
		let slot = get_slot(sys.curr_buffer, i);
		let index = Math.floor(i / sys.curr_buffer.choice_count);
		let x = index % canvas.width;
		let y = Math.floor(index / canvas.width);
		pixels.data[index*4+0] = slot[1] * 255;
		pixels.data[index*4+1] = slot[2] * 255;
		pixels.data[index*4+2] = slot[3] * 255;
		pixels.data[index*4+3] = 255;
	}

	ctx.putImageData(pixels, 0,0);

	window.requestAnimationFrame(render);
}


const Quantumata_Buffer = {
	width: 0,
	height: 0,
	choice_count: 0,
	slots: null,
};
function make_quantumata_buffer(width, height, choice_count = 4) {
	let buffer = Object.assign({}, Quantumata_Buffer);
	buffer.width = width;
	buffer.height = height;
	buffer.choice_count = choice_count;
	buffer.slots = new Array(buffer.width * buffer.height * buffer.choice_count).fill(0.0);
	return buffer;
}
function clear_buffer(buffer) {
	for (let i = 0; i < buffer.slots.length; i += 1) {
		buffer.slots[i] = 0.0;
	}
}
function copy_buffers(a, b) {
	for (let i = 0; i < a.slots.length; i += 1) {
		b.slots[i] = a.slots[i];
	}
}
function normalize_probabilities(probabilities) {
	{
		let total = 0.0;
		for (let j = 0; j < probabilities.length; j += 1) {
			if (probabilities[j] < 0.0) {
				total += probabilities[j];
			}
		}
		for (let j = 0; j < probabilities.length; j += 1) {
			probabilities[j] += -total;
		}
	}
	{
		let total = 0.0;
		for (let j = 0; j < probabilities.length; j += 1) {
			total += probabilities[j];
		}
		let total_reciprocal = 1 / total;
		for (let j = 0; j < probabilities.length; j += 1) {
			probabilities[j] *= total_reciprocal;
		}
	}
}
function normalize_buffer(buffer) {
	for (let i = 0; i < buffer.slots.length; i += buffer.choice_count) {
		let total = 0.0;
		for (let j = 0; j < buffer.choice_count; j += 1) {
			if (buffer.slots[i + j] < 0.0) {
				total += buffer.slots[i + j];
			}
		}
		for (let j = 0; j < buffer.choice_count; j += 1) {
			buffer.slots[i + j] += -total;
		}
	}
	for (let i = 0; i < buffer.slots.length; i += buffer.choice_count) {
		let total = 0.0;
		for (let j = 0; j < buffer.choice_count; j += 1) {
			total += buffer.slots[i + j];
		}
		let total_reciprocal = 1 / total;
		for (let j = 0; j < buffer.choice_count; j += 1) {
			buffer.slots[i + j] *= total_reciprocal;
		}
	}
}
function get_slot(buffer, index) {
	let results = new Array(buffer.choice_count);
	for (let i = 0; i < buffer.choice_count; i += 1) {
		results[i] = buffer.slots[index + i];
	}
	return results;
}

function init_slots() {
	sys.buffers = new Array(2);
	sys.buffers[0] = make_quantumata_buffer(canvas.width, canvas.height);
	sys.buffers[1] = make_quantumata_buffer(canvas.width, canvas.height);
	sys.buffer_index = 0;
	sys.curr_buffer = sys.buffers[sys.buffer_index];
	sys.next_buffer = sys.buffers[sys.buffer_index+1];
}
function init_sources() {
	init_something(sys.curr_buffer);
	// init_three_centers(sys.curr_buffer);
	copy_buffers(sys.curr_buffer, sys.next_buffer);
}
function init_something(buffer) {
	for (let i = 0; i < buffer.slots.length; i += buffer.choice_count) {
		let nothing_amount = 1.0;
		let everything_amount = 1.0 - nothing_amount;
		let something_amount = everything_amount / (buffer.choice_count-1);
		buffer.slots[i] = nothing_amount;
		for (let j = 1; j < buffer.choice_count; j += 1) {
			buffer.slots[i + j] = something_amount;
		}
	}
}
function init_three_centers(buffer) {
	let x = Math.floor(canvas.width / 3);
	let y = Math.floor(canvas.height / 3);
	add_center(buffer, x, y);
	x = Math.floor(canvas.width / 3) * 2;
	y = Math.floor(canvas.height / 3);
	add_center(buffer, x, y);
	x = Math.floor(canvas.width / 2);
	y = Math.floor(canvas.height / 3) * 2;
	add_center(buffer, x, y);
}
function add_center(buffer, x, y) {
	let top_left_index       = get_slot_2d_index(buffer, x-1, y-1);
	let mid_left_index       = get_slot_2d_index(buffer, x-1, y-0);
	let mid_center_index     = get_slot_2d_index(buffer, x-0, y-0);
	let mid_right_index      = get_slot_2d_index(buffer, x+1, y-0);
	let bottom_left_index    = get_slot_2d_index(buffer, x-1, y+1);
	let bottom_center_index  = get_slot_2d_index(buffer, x-0, y+1);

	set_slot(buffer, top_left_index, 1);
	set_slot(buffer, mid_left_index, 1);
	set_slot(buffer, mid_center_index, 2);
	set_slot(buffer, mid_right_index, 2);
	set_slot(buffer, bottom_left_index, 3);
	set_slot(buffer, bottom_center_index, 3);
}
function set_slot(buffer, index, choice) {
	for (let i = 0; i < buffer.choice_count; i += 1) {
		if (i == choice) {
			buffer.slots[index * buffer.choice_count + i] = 1.0;
		}
		else {
			buffer.slots[index * buffer.choice_count + i] = 0.0;
		}
	}
}
function init_random(buffer) {
	for (let i = 0; i < buffer.slots.length; i += 1) {
		buffer.slots[i] = Math.random();
	}
	normalize_buffer(buffer);
}
function swap_buffers() {
	sys.buffer_index = (sys.buffer_index + 1) % 2;
	sys.curr_buffer = sys.buffers[sys.buffer_index];
	let next_index = (sys.buffer_index + 1) % 2;
	sys.next_buffer = sys.buffers[next_index];
	copy_buffers(sys.curr_buffer, sys.next_buffer);
}
function calculate_next_frame() {
	let choice_count = sys.curr_buffer.choice_count;
	let max_index = sys.curr_buffer.slots.length / choice_count;
	for (let i = 0; i < max_index; i += 1) {
		let x = i % canvas.width;
		let y = Math.floor(i / canvas.width);
		let probabilities = get_slot(sys.curr_buffer, i);

		let up_left_index  = get_slot_2d_index(sys.curr_buffer, x-1, y-1);
		let up_index       = get_slot_2d_index(sys.curr_buffer, x-0, y-1);
		let up_right_index = get_slot_2d_index(sys.curr_buffer, x+1, y-1);

		let left_index  = get_slot_2d_index(sys.curr_buffer, x-1, y-0);
		let self_index  = get_slot_2d_index(sys.curr_buffer, x-0, y-0);
		let right_index = get_slot_2d_index(sys.curr_buffer, x+1, y-0);

		let down_left_index  = get_slot_2d_index(sys.curr_buffer, x-1, y+1);
		let down_index       = get_slot_2d_index(sys.curr_buffer, x-0, y+1);
		let down_right_index = get_slot_2d_index(sys.curr_buffer, x+1, y+1);

		let neighbor_indexes = [
		                        up_left_index,   up_index,   up_right_index,
		                        left_index,      self_index, right_index,
		                        down_left_index, down_index, down_right_index,
		                       ];

		let self_probabilities = new Array(choice_count).fill(0.0);
		for (let j = 0; j < choice_count; j += 1) {
			for (let k = 0; k < neighbor_indexes.length; k += 1) {
				self_probabilities[j] += sys.curr_buffer.slots[neighbor_indexes[k] * choice_count + j] * self_weights[k];
			}
		}
		normalize_probabilities(self_probabilities);

		let neighbor_probabilities = new Array(choice_count).fill(0.0);
		for (let j = 0; j < choice_count; j += 1) {
			for (let k = 0; k < neighbor_indexes.length; k += 1) {
				neighbor_probabilities[j] += sys.curr_buffer.slots[neighbor_indexes[k] * choice_count + j] * neighbor_weights[k];
			}
		}
		normalize_probabilities(neighbor_probabilities);

		for (let j = 0; j < choice_count; j += 1) {
			for (let k = 0; k < choice_count; k += 1) {
				let slot = j;
				let other_slot = k;
				let effect_amount = self_probabilities[j] * neighbor_probabilities[k];
				if (slot == 0) {
					sys.next_buffer.slots[i*choice_count + slot] += lose_amount * effect_amount;
					sys.next_buffer.slots[i*choice_count + other_slot] += win_amount * effect_amount;
				}
				else if (slot == 1) {
					if (other_slot == 2) {
						sys.next_buffer.slots[i*choice_count + slot] += lose_amount * effect_amount;
						sys.next_buffer.slots[i*choice_count + other_slot] += win_amount * effect_amount;
						sys.next_buffer.slots[i*choice_count + 3] += other_amount * effect_amount;
					}
					else {
						sys.next_buffer.slots[i*choice_count + slot] += idle_amount * effect_amount;
					}
				}
				else if (slot == 2) {
					if (other_slot == 3) {
						sys.next_buffer.slots[i*choice_count + slot] += lose_amount * effect_amount;
						sys.next_buffer.slots[i*choice_count + other_slot] += win_amount * effect_amount;
						sys.next_buffer.slots[i*choice_count + 1] += other_amount * effect_amount;
					}
					else {
						sys.next_buffer.slots[i*choice_count + slot] += idle_amount * effect_amount;
					}
				}
				else if (slot == 3) {
					if (other_slot == 1) {
						sys.next_buffer.slots[i*choice_count + slot] += lose_amount * effect_amount;
						sys.next_buffer.slots[i*choice_count + other_slot] += win_amount * effect_amount;
						sys.next_buffer.slots[i*choice_count + 2] += other_amount * effect_amount;
					}
					else {
						sys.next_buffer.slots[i*choice_count + slot] += idle_amount * effect_amount;
					}
				}
			}
		}
	}
	if (sys.noise_active) {
		add_noise(sys.next_buffer, noise_amount);
	}
	normalize_buffer(sys.next_buffer);
}
function add_noise(buffer, amount) {
	for (let i = 0; i < buffer.slots.length; i += buffer.choice_count) {
		for (let j = 1; j < buffer.choice_count; j += 1) {
			let random = Math.random() * amount;
			buffer.slots[i + j] += random;
		}
	}
}
function get_slot_2d(buffer, x, y) {
	let index = get_slot_2d_index(x, y);
	return get_slot(buffer, index * buffer.choice_count);
}
function get_slot_2d_index(buffer, x, y) {
	if (x < 0) {
		x += (Math.floor(Math.abs(x) / canvas.width) + 1) * canvas.width;
	}
	else if (x >= canvas.width) {
		x -= Math.floor(Math.abs(x) / canvas.width) * canvas.width;
	}
	if (y < 0) {
		y += (Math.floor(Math.abs(y) / canvas.height) + 1) * canvas.height;
	}
	else if (y >= canvas.height) {
		y -= Math.floor(Math.abs(y) / canvas.height) * canvas.height;
	}
	return y * canvas.width + x;
}
// probabilities are expected to be normalized
function collapse(probabilities) {
	let random = Math.random();
	let cursor = 0.0;
	for (let i = 0; i < probabilities.length; i += 1) {
		cursor += probabilities[i];
		if (cursor >= random) {
			return i;
		}
	}
	return -1;
}
function collapse_many(arr) {
	let results = new Array(arr.length);
	for (let i = 0; i < arr.length; i += 1) {
		let slot = arr[i];
		results[i] = collapse(slot);
	}
	return results;
}
function get_median(arr) {
	let histogram = get_histogram(arr);
	let keys = Object.keys(histogram);
	let max_key = 0;
	let max_value = 0;
	for (let i = 0; i < keys.length; i += 1) {
		let key = keys[i];
		let value = histogram[key];
		if (key == "0") {
			continue;
		}
		if (value > max_value) {
			max_key = key;
			max_value = value;
		}
	}
	return parseInt(max_key);
}
function get_histogram(arr) {
	let buckets = {};
	for (let i = 0; i < arr.length; i += 1) {
		let value = arr[i];
		if (!buckets.hasOwnProperty(value)) {
			buckets[value] = 1;
		}
		else {
			buckets[value] += 1;
		}
	}
	return buckets;
}
function top_n_from(count, arr) {
	let results = new Array(count).fill(0);
	let max_values = new Array(count).fill(0);
	let histogram = get_histogram(arr);
	let keys = Object.keys(histogram);
	for (let i = 0; i < keys.length; i += 1) {
		let key = keys[i];
		let value = histogram[key];
		if (value > results[0]) {
			for (let j = 0; j < count-1; j += 1) {
				max_values[j+1] = max_values[j];
				results[j+1] = results[j];
			}
			max_values[0] = value;
			results[0] = parseInt(key);
		}
	}
	return results;
}
function get_many_by_index(arr, indexes) {
	let results = new Array(indexes.length);
	for (let i = 0; i < indexes.length; i += 1) {
		let index = indexes[i];
		results[i] = arr[index];
	}
	return results;
}
function many_randoms(count, max) {
	let results = new Array(count);
	for (let i = 0; i < count; i += 1) {
		results[i] = Math.floor(Math.random() * max);
	}
	return results;
}

main();