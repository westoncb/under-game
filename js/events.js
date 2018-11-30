class Events {
	static enqueue(name, data) {
		Events.queue.push({name, data});
	}

	static dequeue() {
		return Events.queue.shift();
	}

	static empty() {
		return Events.queue.length === 0;
	}
}
Events.queue = []

module.exports = Events;