define(['ash'], function (Ash) {

    var AutoPlayComponent = Ash.Class.extend({
        
        // general status
        isPendingExploring: false,
        isExploring: false,
        isManagingCamps: false,
        
        // explore objective
        exploreGoal: null,
        exploreSector: null,
        explorePath: null,
        isExploreGoalComplete: false,
        
        constructor: function () {
        },
        
        isExploreObjectiveSet: function () {
            return this.exploreGoal;
        },
        
        setExploreObjective: function (goal, sector, path) {
            this.exploreGoal = goal;
            this.exploreSector = sector;
            this.explorePath = path;
            this.isExploreGoalComplete = false;
        }
        
    });

    return AutoPlayComponent;
});
