module powerbi.extensibility.visual {
    export class Visual implements IVisual {
        private target: HTMLElement;
        private selectionManager: ISelectionManager;
        private selectionIds: any = {};
        private host: IVisualHost;
        private isEventUpdate: boolean = false;
        private lastSelectedValue: string;
        private settings: any;
        private prevDataViewObjects: any = {}; // workaround temp variable because the PBI SDK doesn't correctly identify style changes. See getSettings method.

        constructor(options: VisualConstructorOptions) {
            this.target = options.element;
            this.host = options.host;
            this.selectionManager = options.host.createSelectionManager();
        }

        public update(options: VisualUpdateOptions) {
            var dataView = options.dataViews[0];

            var settingsChanged = this.getSettings(dataView.metadata.objects); // workaround because of sdk bug that doesn't notify when only style has changed

            if (settingsChanged && options.type & VisualUpdateType.Data && !this.isEventUpdate) {
                this.init(options);
            }
        }

        public init(options: VisualUpdateOptions) {

            // Return if we don't have a category
            if (!options ||
                !options.dataViews ||
                !options.dataViews[0] ||
                !options.dataViews[0].categorical ||
                !options.dataViews[0].categorical.categories ||
                !options.dataViews[0].categorical.categories[0]) {
                return;
            }

            // remove any children from previous renders
            while (this.target.firstChild) {
                this.target.removeChild(this.target.firstChild);
            }

            // clear out any previous selection ids
            this.selectionIds = {};

            // get the category data.
            let category = options.dataViews[0].categorical.categories[0];
            let values = category.values;

            // build selection ids to be used by filtering capabilities later
            values.forEach((item: number, index: number) => {

                // create an in-memory version of the selection id so it can be used in onclick event.
                this.selectionIds[item] = this.host.createSelectionIdBuilder()
                    .withCategory(category, index)
                    .createSelectionId();

                let value = item.toString();

                let radio = document.createElement("input");
                radio.type = "radio";
                radio.value = value;
                radio.name = "values";
                radio.onclick = function (ev) {

                    this.isEventUpdate = true; // This is checked in the update method. If true it won't re-render, this prevents and infinite loop
                    this.selectionManager.clear(); // Clean up previous filter before applying another one.

                    if (this.lastSelectedValue !== ev.srcElement.value) { // only create a selection if the values are different

                        // Find the selectionId and select it
                        this.selectionManager.select(this.selectionIds[value]).then((ids: ISelectionId[]) => {
                            /*ids.forEach(function (id) {
                                console.log(id);
                            });*/
                        });

                        this.lastSelectedValue = value;

                    } else {
                        ev.srcElement.checked = false; // clear the radio button selection because they have selected a radio button that is already selected
                        this.lastSelectedValue = "";
                    }

                    // This call applys the previously selected selectionId
                    this.selectionManager.applySelectionFilter();


                }.bind(this);

                let label = document.createElement("label");
                label.innerHTML += value;

                this.target.appendChild(radio);
                this.target.appendChild(label);
                if (this.settings.vertical) {
                    this.target.appendChild(document.createElement("br"));
                }
            })
        }

        /**
         * Enumerates through the objects defined in the capabilities and adds the properties to the format pane
         *
         * @function
         * @param {EnumerateVisualObjectInstancesOptions} options - Map of defined objects
         */
        @logExceptions()
        public enumerateObjectInstances(options: EnumerateVisualObjectInstancesOptions): VisualObjectInstanceEnumeration {
            if (!this.settings) {
                return;
            }

            let objectName = options.objectName;
            let objectEnumeration: VisualObjectInstance[] = [];

            switch (objectName) {
                case 'general':
                    objectEnumeration.push({
                        objectName: objectName,
                        properties: {
                            vertical: this.settings.vertical
                        },
                        selector: null
                    });
                    break;
            };

            return objectEnumeration;
        }

        public destroy(): void {
            //TODO: Perform any cleanup tasks here
        }

        // Reads in settings values from the DataViewObjects and returns a settings object that the liquidFillGauge library understands
        @logExceptions()
        private getSettings(objects: DataViewObjects): boolean {
            var settingsChanged = false;

            if (typeof this.settings == 'undefined' || (JSON.stringify(objects) !== JSON.stringify(this.prevDataViewObjects))) {
                this.settings = {
                    vertical: getValue<boolean>(objects, 'general', 'vertical', false)
                };

                settingsChanged = true;
            }
            this.prevDataViewObjects = objects;
            return settingsChanged;
        }
    }
    export function logExceptions(): MethodDecorator {
        return function (target: Object, propertyKey: string, descriptor: TypedPropertyDescriptor<Function>)
            : TypedPropertyDescriptor<Function> {

            return {
                value: function () {
                    try {
                        return descriptor.value.apply(this, arguments);
                    } catch (e) {
                        console.error(e);
                        throw e;
                    }
                }
            }
        }
    }
}