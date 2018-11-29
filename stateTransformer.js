/*
	This just defines the interface for any StateTransformer.
	simulation.js is responsible for triggering the methods
	in the interface at the appropriate times, on the active
	StateTransformer.

	You can change the current StateTransformer using:

	Events.enqueue('change_transformer', {transformer: someStateTransformer});
*/
class StateTransformer {
	setUp() {}
	tearDown() {}
	handleEvent(event) {}
	update(time, deltaTime) {}
	render() {}
}

module.exports = StateTransformer;